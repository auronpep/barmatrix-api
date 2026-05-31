import type Stripe from "stripe";
import { getPool, type DbPool } from "../db.js";

export type StripeEventAuditStatus =
  | "received"
  | "processing"
  | "processed"
  | "ignored"
  | "failed";

export type StripeEventAuditClaim =
  | { action: "process" }
  | { action: "skip"; processingStatus: "processed" | "ignored" }
  | { action: "in_progress" };

export interface StripeEventAuditCompletion {
  processingStatus: "processed" | "ignored";
  relatedPurchaseId?: string;
  relatedStudentId?: string;
}

export interface StripeEventAuditStore {
  claim(event: Stripe.Event): Promise<StripeEventAuditClaim>;
  complete(
    eventId: string,
    completion: StripeEventAuditCompletion,
  ): Promise<void>;
  fail(eventId: string, summary: string): Promise<void>;
}

export type StripeEventAuditOutcome =
  | { status: "processed"; processingStatus: "processed" }
  | { status: "ignored"; processingStatus: "ignored" }
  | { status: "replayed"; processingStatus: "processed" | "ignored" }
  | { status: "in_progress" };

export interface RunStripeEventWithAuditInput {
  event: Stripe.Event;
  store?: StripeEventAuditStore;
  handleEvent: (
    event: Stripe.Event,
  ) => Promise<StripeEventAuditCompletion | void>;
}

export class MysqlStripeEventAuditStore implements StripeEventAuditStore {
  constructor(private readonly db: Pick<DbPool, "query"> = getPool()) {}

  async claim(event: Stripe.Event): Promise<StripeEventAuditClaim> {
    try {
      const refs = extractEventReferences(event);
      await this.db.query(
        `INSERT INTO stripe_event_audit_log (
           stripe_event_id, event_type, livemode, api_version,
           stripe_account_id, stripe_request_id, idempotency_key,
           object_id, object_type, stripe_customer_id,
           stripe_checkout_session_id, stripe_payment_intent_id,
           stripe_invoice_id, stripe_subscription_id,
           webhook_signature_verified, processing_status,
           payload_redacted, source_refs, metadata
         )
         VALUES (
           $1, $2, $3, $4,
           $5, $6, $7,
           $8, $9, $10,
           $11, $12,
           $13, $14,
           1, 'processing',
           $15, JSON_ARRAY('SRC-0021','SRC-0032'), JSON_OBJECT()
         )`,
        [
          event.id,
          event.type,
          event.livemode ? 1 : 0,
          event.api_version ?? null,
          event.account ?? null,
          refs.requestId,
          refs.idempotencyKey,
          refs.objectId,
          refs.objectType,
          refs.customerId,
          refs.checkoutSessionId,
          refs.paymentIntentId,
          refs.invoiceId,
          refs.subscriptionId,
          JSON.stringify(redactStripeEventForAudit(event)),
        ],
      );
      return { action: "process" };
    } catch (err) {
      if (!isDuplicateKeyError(err)) {
        throw err;
      }
    }

    const current = await this.loadStatus(event.id);
    if (current === "processed" || current === "ignored") {
      return { action: "skip", processingStatus: current };
    }
    if (current === "processing") {
      return { action: "in_progress" };
    }

    const update = await this.db.query(
      `UPDATE stripe_event_audit_log
          SET processing_status = 'processing',
              retry_count = retry_count + 1,
              error_summary = NULL,
              webhook_signature_verified = 1
        WHERE stripe_event_id = $1
          AND processing_status IN ('received', 'failed')`,
      [event.id],
    );
    if (update.rowCount > 0) {
      return { action: "process" };
    }

    const refreshed = await this.loadStatus(event.id);
    if (refreshed === "processed" || refreshed === "ignored") {
      return { action: "skip", processingStatus: refreshed };
    }
    return { action: "in_progress" };
  }

  async complete(
    eventId: string,
    completion: StripeEventAuditCompletion,
  ): Promise<void> {
    await this.db.query(
      `UPDATE stripe_event_audit_log
          SET processing_status = $2,
              processed_at = CURRENT_TIMESTAMP(6),
              error_summary = NULL,
              related_purchase_id = COALESCE($3, related_purchase_id),
              related_student_id = COALESCE($4, related_student_id)
        WHERE stripe_event_id = $1`,
      [
        eventId,
        completion.processingStatus,
        completion.relatedPurchaseId ?? null,
        completion.relatedStudentId ?? null,
      ],
    );
  }

  async fail(eventId: string, summary: string): Promise<void> {
    await this.db.query(
      `UPDATE stripe_event_audit_log
          SET processing_status = 'failed',
              processed_at = CURRENT_TIMESTAMP(6),
              error_summary = $2
        WHERE stripe_event_id = $1`,
      [eventId, summary],
    );
  }

  private async loadStatus(eventId: string): Promise<StripeEventAuditStatus> {
    const result = await this.db.query<{
      processing_status: StripeEventAuditStatus;
    }>(
      `SELECT processing_status
         FROM stripe_event_audit_log
        WHERE stripe_event_id = $1
        LIMIT 1`,
      [eventId],
    );
    return result.rows[0]?.processing_status ?? "received";
  }
}

export async function runStripeEventWithAudit(
  input: RunStripeEventWithAuditInput,
): Promise<StripeEventAuditOutcome> {
  const store = input.store ?? new MysqlStripeEventAuditStore();
  const claim = await store.claim(input.event);
  if (claim.action === "skip") {
    return {
      status: "replayed",
      processingStatus: claim.processingStatus,
    };
  }
  if (claim.action === "in_progress") {
    return { status: "in_progress" };
  }

  try {
    const completion = (await input.handleEvent(input.event)) ?? {
      processingStatus: "processed" as const,
    };
    await store.complete(input.event.id, completion);
    if (completion.processingStatus === "ignored") {
      return { status: "ignored", processingStatus: "ignored" };
    }
    return { status: "processed", processingStatus: "processed" };
  } catch (err) {
    await store.fail(input.event.id, summarizeStripeWebhookError(err));
    throw err;
  }
}

export function redactStripeEventForAudit(event: Stripe.Event): unknown {
  const refs = extractEventReferences(event);
  const object = getEventObject(event);
  return {
    id: event.id,
    object: event.object,
    type: event.type,
    created: event.created,
    livemode: event.livemode,
    api_version: event.api_version ?? null,
    account_present: Boolean(event.account),
    request_id: refs.requestId,
    has_idempotency_key: Boolean(refs.idempotencyKey),
    data: {
      object: {
        id: refs.objectId,
        object: refs.objectType,
        customer: refs.customerId,
        checkout_session: refs.checkoutSessionId,
        payment_intent: refs.paymentIntentId,
        invoice: refs.invoiceId,
        subscription: refs.subscriptionId,
        metadata_keys: metadataKeys(object),
      },
    },
  };
}

export function summarizeStripeWebhookError(err: unknown): string {
  const raw =
    err instanceof Error
      ? `${err.name || "Error"}: ${err.message || "handler failed"}`
      : "Error: handler failed";
  return raw
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted_email]")
    .replace(/\b\d{4}\b/g, "[redacted_digits]")
    .replace(/\b(?:sk|rk|whsec)_(?:live|test)?_[A-Za-z0-9_]+\b/g, "[redacted_secret]")
    .slice(0, 255);
}

function extractEventReferences(event: Stripe.Event): {
  requestId: string | null;
  idempotencyKey: string | null;
  objectId: string | null;
  objectType: string | null;
  customerId: string | null;
  checkoutSessionId: string | null;
  paymentIntentId: string | null;
  invoiceId: string | null;
  subscriptionId: string | null;
} {
  const object = getEventObject(event);
  const objectId = getStringField(object, "id");
  const objectType = getStringField(object, "object");
  const request = getRequestRefs(event.request as unknown);
  return {
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    objectId,
    objectType,
    customerId: getIdReference(object.customer),
    checkoutSessionId:
      objectType === "checkout.session"
        ? objectId
        : getIdReference(object.checkout_session),
    paymentIntentId: getIdReference(object.payment_intent),
    invoiceId: objectType === "invoice" ? objectId : getIdReference(object.invoice),
    subscriptionId:
      objectType === "subscription" ? objectId : getIdReference(object.subscription),
  };
}

function getEventObject(event: Stripe.Event): Record<string, unknown> {
  const object = event.data.object;
  return typeof object === "object" && object !== null
    ? (object as unknown as Record<string, unknown>)
    : {};
}

function getRequestRefs(request: unknown): {
  requestId: string | null;
  idempotencyKey: string | null;
} {
  if (typeof request === "string") {
    return { requestId: request, idempotencyKey: null };
  }
  if (typeof request !== "object" || request === null) {
    return { requestId: null, idempotencyKey: null };
  }
  const record = request as Record<string, unknown>;
  return {
    requestId: getStringField(record, "id"),
    idempotencyKey: getStringField(record, "idempotency_key"),
  };
}

function getStringField(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getIdReference(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "object" && value !== null) {
    return getStringField(value as Record<string, unknown>, "id");
  }
  return null;
}

function metadataKeys(record: Record<string, unknown>): string[] {
  const metadata = record.metadata;
  if (typeof metadata !== "object" || metadata === null) {
    return [];
  }
  return Object.keys(metadata).sort();
}

function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; errno?: number };
  return e.code === "ER_DUP_ENTRY" || e.errno === 1062;
}
