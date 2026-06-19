import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool, type DbPool } from "../db.js";

const DIAGNOSTIC_LEAD_TYPE = "diagnostic_results";

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
  message: string;
}

interface DiagnosticLeadRow {
  lead_id: string;
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

export async function recordDiagnosticLead(
  input: DiagnosticLeadInput,
  db: Pick<DbPool, "query"> = getPool(),
): Promise<DiagnosticLeadResponse> {
  if (input.website) {
    return {
      ok: true,
      lead_id: null,
      status: "ignored",
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

  return {
    ok: true,
    lead_id: rows[0]?.lead_id ?? null,
    status: insert.rowCount === 1 ? "created" : "updated",
    message: "Your red-zone map is saved. Check your email to claim it.",
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
