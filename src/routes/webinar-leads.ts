import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getPool, type DbPool } from "../db.js";

const WEBINAR_LEAD_TYPE = "webinar_next_session";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const webinarLeadBody = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  full_name: optionalText(255),
  role: optionalText(128),
  jurisdiction: optionalText(64),
  exam_window: optionalText(128),
  context: optionalText(1000),
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

export type WebinarLeadInput = z.infer<typeof webinarLeadBody>;

export interface WebinarLeadResponse {
  ok: true;
  lead_id: string | null;
  status: "created" | "updated" | "ignored";
  message: string;
}

interface WebinarLeadRow {
  lead_id: string;
}

const createWebinarLeadsTableSql = `
CREATE TABLE IF NOT EXISTS webinar_leads (
  lead_id                    CHAR(36)        NOT NULL DEFAULT (UUID()),
  lead_type                  VARCHAR(64)     NOT NULL DEFAULT 'webinar_next_session',
  email                      VARCHAR(255)    NOT NULL,
  full_name                  VARCHAR(255),
  role                       VARCHAR(128),
  jurisdiction               VARCHAR(64),
  exam_window                VARCHAR(128),
  context                    TEXT,
  source_page                VARCHAR(512),
  utm_source                 VARCHAR(128),
  utm_medium                 VARCHAR(128),
  utm_campaign               VARCHAR(128),
  utm_content                VARCHAR(128),
  utm_term                   VARCHAR(128),
  partner_id                 VARCHAR(128),
  referral_click_id          VARCHAR(128),
  wants_next_session_notice  TINYINT(1)      NOT NULL DEFAULT 1,
  email_sent_at              DATETIME(6),
  status                     VARCHAR(32)     NOT NULL DEFAULT 'new',
  created_at                 DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at                 DATETIME(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  metadata                   JSON            NOT NULL,
  PRIMARY KEY (lead_id),
  UNIQUE KEY uq_webinar_leads_email_type (email, lead_type),
  KEY idx_webinar_leads_created (created_at DESC),
  KEY idx_webinar_leads_source (utm_source, utm_campaign)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

let schemaReady: Promise<void> | null = null;

export async function ensureWebinarLeadTable(db: Pick<DbPool, "query">): Promise<void> {
  schemaReady ??= db.query(createWebinarLeadsTableSql).then(
    () => undefined,
    (err) => {
      schemaReady = null;
      throw err;
    },
  );
  await schemaReady;
}

export function webinarLeadMetadata(input: WebinarLeadInput): string {
  return JSON.stringify({
    lead_type: WEBINAR_LEAD_TYPE,
    consent: {
      next_session_notice: true,
      no_autoresponder: true,
    },
    captured_via: input.source_page ?? "/webinar",
    submitted_at: new Date().toISOString(),
  });
}

export async function recordWebinarLead(
  input: WebinarLeadInput,
  db: Pick<DbPool, "query"> = getPool(),
): Promise<WebinarLeadResponse> {
  if (input.website) {
    return {
      ok: true,
      lead_id: null,
      status: "ignored",
      message: "Webinar interest recorded.",
    };
  }

  await ensureWebinarLeadTable(db);
  const values = [
    WEBINAR_LEAD_TYPE,
    input.email,
    input.full_name,
    input.role,
    input.jurisdiction,
    input.exam_window,
    input.context,
    input.source_page,
    input.utm_source,
    input.utm_medium,
    input.utm_campaign,
    input.utm_content,
    input.utm_term,
    input.partner_id,
    input.referral_click_id,
    webinarLeadMetadata(input),
  ] as const;

  const insert = await db.query(
    `INSERT INTO webinar_leads (
       lead_type, email, full_name, role, jurisdiction, exam_window, context,
       source_page, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
       partner_id, referral_click_id, metadata
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       $8, $9, $10, $11, $12, $13,
       $14, $15, $16
     )
     ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       role = VALUES(role),
       jurisdiction = VALUES(jurisdiction),
       exam_window = VALUES(exam_window),
       context = VALUES(context),
       source_page = VALUES(source_page),
       utm_source = VALUES(utm_source),
       utm_medium = VALUES(utm_medium),
       utm_campaign = VALUES(utm_campaign),
       utm_content = VALUES(utm_content),
       utm_term = VALUES(utm_term),
       partner_id = VALUES(partner_id),
       referral_click_id = VALUES(referral_click_id),
       wants_next_session_notice = 1,
       email_sent_at = NULL,
       status = 'new',
       metadata = VALUES(metadata),
       updated_at = CURRENT_TIMESTAMP(6)`,
    values,
  );

  const { rows } = await db.query<WebinarLeadRow>(
    "SELECT lead_id FROM webinar_leads WHERE email = $1 AND lead_type = $2 LIMIT 1",
    [input.email, WEBINAR_LEAD_TYPE],
  );

  return {
    ok: true,
    lead_id: rows[0]?.lead_id ?? null,
    status: insert.rowCount === 1 ? "created" : "updated",
    message:
      "You are on the next-session notification list. No automated email was sent.",
  };
}

export function registerWebinarLeadRoutes(app: Express): void {
  app.post("/api/webinar/leads", async (req: Request, res: Response) => {
    const parsed = webinarLeadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      res.json(await recordWebinarLead(parsed.data));
    } catch (err) {
      console.error("[webinar leads] failed:", err);
      res.status(500).json({ error: "webinar lead capture failed" });
    }
  });
}
