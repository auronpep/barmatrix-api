import type { Express, Request, Response } from "express";
import { getPool, type DbPool } from "../db.js";
import { config } from "../config.js";
import {
  computeDiagnosticResults,
  extractDiagnosticAnchors,
  type DiagnosticAttemptRow,
  type AnchorSourceRow,
} from "../lib/diagnostic.js";
import {
  sendTrapNamingEmail,
  type TrapNamingEmailInput,
  type EnrollmentEmailResult,
} from "../email.js";

// One attempt row of a diagnostic session joined to its question + selected
// choice — mirrors the SELECT behind GET /api/diagnostic/:id/results so the
// Day-1 email names the SAME top trap the results page showed the student.
interface DiagnosticJobRow {
  correct: boolean | 0 | 1;
  confidence: number | null;
  time_seconds: number | null;
  subject: string | null;
  subtopic: string | null;
  tension_point: string | null;
  external_id: string | null;
  metadata: string | null;
  selected_forensic_tags: string | null;
}

interface DiagnosticLeadJobRow {
  lead_id: string;
  email: string;
  diagnostic_id: string;
  full_name: string | null;
}

// Tolerant JSON-array parse (forensic_tags may arrive as JSON text or array).
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

interface TrapAndRule {
  trapName: string | null;
  trapSubject: string | null;
  rule: string | null;
}

// Recompute the top trap + owned rule for one diagnostic session, reusing the
// pure results engine. Read-only: never writes user_red_zones.
async function loadTrapAndRule(
  db: Pick<DbPool, "query">,
  diagnosticId: string,
): Promise<TrapAndRule> {
  const { rows } = await db.query<DiagnosticJobRow>(
    `SELECT a.correct, a.confidence, a.time_seconds,
            q.subject, q.subtopic, q.tension_point,
            q.external_id, q.metadata,
            ac.forensic_tags AS selected_forensic_tags
       FROM student_attempts a
       JOIN questions q ON q.question_id = a.question_id
       LEFT JOIN answer_choices ac ON ac.choice_id = a.selected_choice_id
      WHERE a.set_id = $1
      ORDER BY a.attempted_at ASC`,
    [diagnosticId],
  );
  if (rows.length === 0) {
    return { trapName: null, trapSubject: null, rule: null };
  }
  const attempts: DiagnosticAttemptRow[] = rows.map((r) => ({
    correct: r.correct,
    confidence: r.confidence,
    time_seconds: r.time_seconds,
    subject: r.subject,
    subtopic: r.subtopic,
    tension_point: r.tension_point,
    selected_forensic_tags: parseTags(r.selected_forensic_tags),
  }));
  const results = computeDiagnosticResults(attempts);
  const anchorRows: AnchorSourceRow[] = rows.map((r) => ({
    metadata: r.metadata,
    external_id: r.external_id,
    subject: r.subject,
  }));
  const anchors = extractDiagnosticAnchors(anchorRows);
  const topTrap = results.top_trap_patterns[0] ?? null;
  return {
    trapName: topTrap?.label ?? null,
    trapSubject: topTrap?.subject ?? null,
    rule: anchors[0]?.rule ?? null,
  };
}

let schemaReady = false;
async function ensureSendColumn(db: Pick<DbPool, "query">): Promise<void> {
  if (schemaReady) return;
  // diagnostic_leads is created by the lead-capture route; add a send marker so
  // the Day-1 email fires at most once per lead. ADD COLUMN IF NOT EXISTS is
  // MariaDB-supported and idempotent.
  await db.query(
    "ALTER TABLE diagnostic_leads ADD COLUMN IF NOT EXISTS trap_email_sent_at DATETIME(6) NULL",
  );
  schemaReady = true;
}

export interface TrapNamingJobItem {
  email: string;
  diagnostic_id: string;
  trap_name: string | null;
  trap_subject: string | null;
  has_rule: boolean;
  outcome: "sent" | "skipped" | "would_send" | "error";
  reason?: string;
}

export interface TrapNamingJobSummary {
  send: boolean;
  since_hours: number;
  eligible: number;
  sent: number;
  skipped: number;
  errors: number;
  items: TrapNamingJobItem[];
}

function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

// Find diagnostic leads captured in the recent window that have not yet been
// sent the Day-1 trap email; for each, name their top trap + owned rule and
// (when send=true) email them, marking the lead so it never double-sends.
export async function runTrapNamingJob(opts: {
  send: boolean;
  sinceHours?: number;
  limit?: number;
  db?: Pick<DbPool, "query">;
  // Injectable seams so the orchestration is unit-testable without a live DB,
  // the diagnostic engine, or the network.
  loadTrap?: (
    db: Pick<DbPool, "query">,
    diagnosticId: string,
  ) => Promise<TrapAndRule>;
  sendEmail?: (input: TrapNamingEmailInput) => Promise<EnrollmentEmailResult>;
}): Promise<TrapNamingJobSummary> {
  const db = opts.db ?? getPool();
  const loadTrap = opts.loadTrap ?? loadTrapAndRule;
  const sendEmail = opts.sendEmail ?? sendTrapNamingEmail;
  const sinceHours = opts.sinceHours ?? 36;
  const limit = Math.min(opts.limit ?? 200, 500);
  await ensureSendColumn(db);

  const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const { rows: leads } = await db.query<DiagnosticLeadJobRow>(
    `SELECT lead_id, email, diagnostic_id, full_name
       FROM diagnostic_leads
      WHERE trap_email_sent_at IS NULL
        AND diagnostic_id IS NOT NULL
        AND created_at >= $1
      ORDER BY created_at ASC
      LIMIT $2`,
    [cutoff, limit],
  );

  const items: TrapNamingJobItem[] = [];
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const lead of leads) {
    const { trapName, trapSubject, rule } = await loadTrap(db, lead.diagnostic_id);
    const base = {
      email: maskEmail(lead.email),
      diagnostic_id: lead.diagnostic_id,
      trap_name: trapName,
      trap_subject: trapSubject,
      has_rule: rule !== null,
    };

    // Never send an email with empty placeholders.
    if (!trapName || !rule) {
      skipped += 1;
      items.push({ ...base, outcome: "skipped", reason: "missing_trap_or_rule" });
      continue;
    }

    if (!opts.send) {
      items.push({ ...base, outcome: "would_send" });
      continue;
    }

    try {
      const result = await sendEmail({
        to: lead.email,
        fullName: lead.full_name,
        trapNames: [trapName],
        trapSubject,
        doctrinalRule: rule,
      });
      if (result.status === "sent") {
        await db.query(
          "UPDATE diagnostic_leads SET trap_email_sent_at = NOW(6) WHERE lead_id = $1",
          [lead.lead_id],
        );
        sent += 1;
        items.push({ ...base, outcome: "sent" });
      } else {
        skipped += 1;
        items.push({ ...base, outcome: "skipped", reason: result.reason });
      }
    } catch (err) {
      errors += 1;
      console.error("[trap-naming job] send failed:", err);
      items.push({ ...base, outcome: "error" });
    }
  }

  return {
    send: opts.send,
    since_hours: sinceHours,
    eligible: leads.length,
    sent,
    skipped,
    errors,
    items,
  };
}

// Secured internal endpoint. DRY-RUN by default; only sends when an explicit
// `?send=true` (or {"send":true}) is passed WITH the shared secret. Inert until
// INTERNAL_JOB_SECRET is set, so it can deploy dark and never fire by accident.
export function registerTrapNamingJobRoutes(app: Express): void {
  app.post(
    "/api/internal/jobs/trap-naming-email",
    async (req: Request, res: Response) => {
      const secret = config.internalJobSecret;
      if (!secret) {
        res
          .status(503)
          .json({ error: "internal jobs disabled (INTERNAL_JOB_SECRET not set)" });
        return;
      }
      if (req.header("x-internal-secret") !== secret) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      const send = req.query.send === "true" || req.body?.send === true;
      try {
        res.json(await runTrapNamingJob({ send }));
      } catch (err) {
        console.error("[trap-naming job] failed:", err);
        res.status(500).json({ error: "trap-naming job failed" });
      }
    },
  );
}
