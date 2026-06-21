import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool, type DbPool } from "../db.js";
import {
  computeDiagnosticResults,
  extractDiagnosticAnchors,
  redZoneDimensionsFromMetadata,
  type DiagnosticAttemptRow,
  type AnchorSourceRow,
} from "../lib/diagnostic.js";
import {
  sendDiagnosticResultsEmail,
  type DiagnosticResultsEmailInput,
  type EnrollmentEmailResult,
} from "../email.js";

const DIAGNOSTIC_LEAD_TYPE = "diagnostic_results";
const DEFAULT_FRONTEND_URL = "https://barmatrix.app";
const DIAGNOSTIC_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const diagnosticLeadBody = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  // Lenient on purpose: capturing the email is the priority. The claim path
  // (claim-diagnostic.ts) already filters to valid UUIDs, so a malformed id
  // must never 400 the request and drop the lead.
  diagnostic_id: optionalText(64),
  full_name: optionalText(255),
  jurisdiction: optionalText(64),
  source_page: optionalText(512),
  utm_source: optionalText(128),
  utm_medium: optionalText(128),
  utm_campaign: optionalText(128),
  utm_content: optionalText(128),
  utm_term: optionalText(128),
  partner_id: optionalText(128),
  referral_click_id: optionalText(128),
  // Basic bot trap. The handler returns a neutral success without storing.
  website: optionalText(255),
});

export type DiagnosticLeadInput = z.infer<typeof diagnosticLeadBody>;

export interface DiagnosticLeadResponse {
  ok: true;
  lead_id: string | null;
  status: "created" | "updated" | "ignored";
  email_status?: "sent" | "skipped" | "failed" | "not_requested";
  email_reason?: string;
  message: string;
}

interface DiagnosticLeadRow {
  lead_id: string;
}

interface DiagnosticEmailAttemptRow {
  question_id: string;
  correct: boolean | 0 | 1;
  confidence: number | null;
  time_seconds: number | null;
  subject: string | null;
  subtopic: string | null;
  tension_point: string | null;
  external_id: string | null;
  metadata: string | null;
  selected_forensic_tags: unknown;
}

interface DiagnosticLeadRecordOptions {
  frontendUrl?: string;
  loadEmailContext?: (
    db: Pick<DbPool, "query">,
    diagnosticId: string,
  ) => Promise<DiagnosticEmailContext>;
  sendEmail?: (input: DiagnosticResultsEmailInput) => Promise<EnrollmentEmailResult>;
  logger?: Pick<typeof console, "warn" | "error">;
}

interface DiagnosticEmailContext {
  topTraps: string[];
  topRule: string | null;
  scoreSummary: string | null;
}

const createDiagnosticLeadsTableSql = `
CREATE TABLE IF NOT EXISTS diagnostic_leads (
  lead_id            CHAR(36)        NOT NULL DEFAULT (UUID()),
  lead_type          VARCHAR(64)     NOT NULL DEFAULT 'diagnostic_results',
  email              VARCHAR(255)    NOT NULL,
  diagnostic_id      VARCHAR(64),
  full_name          VARCHAR(255),
  jurisdiction       VARCHAR(64),
  source_page        VARCHAR(512),
  utm_source         VARCHAR(128),
  utm_medium         VARCHAR(128),
  utm_campaign       VARCHAR(128),
  utm_content        VARCHAR(128),
  utm_term           VARCHAR(128),
  partner_id         VARCHAR(128),
  referral_click_id  VARCHAR(128),
  status             VARCHAR(32)     NOT NULL DEFAULT 'new',
  created_at         DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at         DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  metadata           JSON            NOT NULL,
  PRIMARY KEY (lead_id),
  UNIQUE KEY uq_diagnostic_leads_email_diag (email, diagnostic_id),
  KEY idx_diagnostic_leads_email_created (email, created_at DESC),
  KEY idx_diagnostic_leads_created (created_at DESC),
  KEY idx_diagnostic_leads_source (utm_source, utm_campaign)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

let schemaReady: Promise<void> | null = null;

export async function ensureDiagnosticLeadTable(
  db: Pick<DbPool, "query">,
): Promise<void> {
  schemaReady ??= db.query(createDiagnosticLeadsTableSql).then(
    () => undefined,
    (err) => {
      schemaReady = null;
      throw err;
    },
  );
  await schemaReady;
}

export function diagnosticLeadMetadata(input: DiagnosticLeadInput): string {
  return JSON.stringify({
    lead_type: DIAGNOSTIC_LEAD_TYPE,
    diagnostic_id: input.diagnostic_id ?? null,
    captured_via: input.source_page ?? "/diagnostic/results",
    submitted_at: new Date().toISOString(),
  });
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function parseTags(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = null;
    }
  }
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

async function loadDiagnosticEmailContext(
  db: Pick<DbPool, "query">,
  diagnosticId: string,
): Promise<DiagnosticEmailContext> {
  const { rows } = await db.query<DiagnosticEmailAttemptRow>(
    `SELECT a.question_id,
            a.correct, a.confidence, a.time_seconds,
            q.subject, q.subtopic, q.tension_point,
            q.external_id, q.metadata,
            ac.forensic_tags AS selected_forensic_tags
       FROM student_attempts a
       JOIN questions q ON q.question_id = a.question_id
       LEFT JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
      WHERE a.set_id = $1
        AND a.attempted_at = (
          SELECT MAX(a2.attempted_at)
            FROM student_attempts a2
           WHERE a2.set_id = $1
             AND a2.question_id = a.question_id
        )
      ORDER BY a.attempted_at ASC`,
    [diagnosticId],
  );
  if (rows.length === 0) {
    return { topTraps: [], topRule: null, scoreSummary: null };
  }
  const attempts: DiagnosticAttemptRow[] = rows.map((r) => ({
    correct: r.correct,
    confidence: r.confidence,
    time_seconds: r.time_seconds,
    subject: r.subject,
    subtopic: r.subtopic,
    tension_point: r.tension_point,
    red_zone_dimensions: redZoneDimensionsFromMetadata(r.metadata),
    selected_forensic_tags: parseTags(r.selected_forensic_tags),
  }));
  const results = computeDiagnosticResults(attempts);
  const anchorRows: AnchorSourceRow[] = rows.map((r) => ({
    metadata: r.metadata,
    external_id: r.external_id,
    subject: r.subject,
  }));
  const anchors = extractDiagnosticAnchors(anchorRows);
  const misses = results.summary.total - results.summary.correct;
  const highConfidence = results.summary.high_confidence_misses;
  return {
    topTraps: results.top_trap_patterns.map((trap) => trap.label),
    topRule: anchors[0]?.rule ?? null,
    scoreSummary:
      results.summary.total > 0
        ? `${results.summary.correct}/${results.summary.total} correct, ${misses} misses, ${highConfidence} high-confidence misses`
        : null,
  };
}

function sourceParam(input: DiagnosticLeadInput): string {
  return input.utm_source ?? input.source_page ?? "diagnostic_results";
}

function diagnosticResultsUrl(frontendUrl: string, diagnosticId: string): string {
  return `${stripTrailingSlash(frontendUrl)}/diagnostic/${diagnosticId}/results?gate=emailed`;
}

function diagnosticSalesUrl(frontendUrl: string, input: DiagnosticLeadInput): string {
  const url = new URL(`${stripTrailingSlash(frontendUrl)}/checkout`);
  url.searchParams.set("diagnostic_id", input.diagnostic_id ?? "");
  url.searchParams.set("source", "diagnostic_email");
  url.searchParams.set("campaign", input.utm_campaign ?? "red_zone_map");
  url.searchParams.set("lp", sourceParam(input));
  if (input.partner_id) url.searchParams.set("partner_id", input.partner_id);
  if (input.referral_click_id) url.searchParams.set("referral_click_id", input.referral_click_id);
  return url.toString();
}

async function sendLeadDiagnosticEmail(
  input: DiagnosticLeadInput,
  db: Pick<DbPool, "query">,
  options: DiagnosticLeadRecordOptions,
): Promise<{ status: DiagnosticLeadResponse["email_status"]; reason?: string }> {
  const diagnosticId = input.diagnostic_id ?? "";
  if (!DIAGNOSTIC_ID_RE.test(diagnosticId)) {
    return { status: "not_requested", reason: "missing_diagnostic_id" };
  }

  const frontendUrl = options.frontendUrl ?? process.env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL;
  const loadContext = options.loadEmailContext ?? loadDiagnosticEmailContext;
  const sendEmail = options.sendEmail ?? sendDiagnosticResultsEmail;
  try {
    const context = await loadContext(db, diagnosticId);
    const result = await sendEmail({
      to: input.email,
      fullName: input.full_name,
      diagnosticId,
      resultsUrl: diagnosticResultsUrl(frontendUrl, diagnosticId),
      salesPageUrl: diagnosticSalesUrl(frontendUrl, input),
      topTraps: context.topTraps,
      topRule: context.topRule,
      scoreSummary: context.scoreSummary,
    });
    if (result.status === "sent") return { status: "sent" };
    return { status: result.status, reason: result.reason };
  } catch (err) {
    options.logger?.error("[diagnostic leads] results email failed:", err);
    return { status: "failed", reason: "resend_error" };
  }
}

export async function recordDiagnosticLead(
  input: DiagnosticLeadInput,
  db: Pick<DbPool, "query"> = getPool(),
  options: DiagnosticLeadRecordOptions = {},
): Promise<DiagnosticLeadResponse> {
  if (input.website) {
    return {
      ok: true,
      lead_id: null,
      status: "ignored",
      email_status: "not_requested",
      message: "Diagnostic results saved.",
    };
  }

  await ensureDiagnosticLeadTable(db);
  const storedDiagnosticId = input.diagnostic_id ?? "";
  const values = [
    DIAGNOSTIC_LEAD_TYPE,
    input.email,
    storedDiagnosticId,
    input.full_name,
    input.jurisdiction,
    input.source_page,
    input.utm_source,
    input.utm_medium,
    input.utm_campaign,
    input.utm_content,
    input.utm_term,
    input.partner_id,
    input.referral_click_id,
    diagnosticLeadMetadata(input),
  ] as const;

  const insert = await db.query(
    `INSERT INTO diagnostic_leads (
       lead_type, email, diagnostic_id, full_name, jurisdiction, source_page,
       utm_source, utm_medium, utm_campaign, utm_content, utm_term,
       partner_id, referral_click_id, metadata
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11,
       $12, $13, $14
     )
     ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       jurisdiction = VALUES(jurisdiction),
       source_page = VALUES(source_page),
       utm_source = VALUES(utm_source),
       utm_medium = VALUES(utm_medium),
       utm_campaign = VALUES(utm_campaign),
       utm_content = VALUES(utm_content),
       utm_term = VALUES(utm_term),
       partner_id = VALUES(partner_id),
       referral_click_id = VALUES(referral_click_id),
       status = 'new',
       metadata = VALUES(metadata),
       updated_at = CURRENT_TIMESTAMP(6)`,
    values,
  );

  const { rows } = await db.query<DiagnosticLeadRow>(
    `SELECT lead_id FROM diagnostic_leads
      WHERE email = $1
        AND diagnostic_id = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    [input.email, storedDiagnosticId],
  );
  const email = await sendLeadDiagnosticEmail(input, db, options);

  return {
    ok: true,
    lead_id: rows[0]?.lead_id ?? null,
    status: insert.rowCount === 1 ? "created" : "updated",
    email_status: email.status,
    email_reason: email.reason,
    message: "Your red-zone map is saved and ready. Check your email for the saved link.",
  };
}

export function registerDiagnosticLeadRoutes(app: Express): void {
  app.post("/api/diagnostic/lead", async (req: Request, res: Response) => {
    const parsed = diagnosticLeadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.json(await recordDiagnosticLead(parsed.data));
    } catch (err) {
      console.error("[diagnostic leads] failed:", err);
      res.status(500).json({ error: "diagnostic lead capture failed" });
    }
  });
}
