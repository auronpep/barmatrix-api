import type { DbPool } from "../db.js";
import type { DayPlanManifest, DayPlanStep, LeadMeV5ItemPreview } from "./day-plan.js";

export const LEADME_V5_ASSAULT_SET_ID = "LMS-TORTS-64010101-ASSAULT";

type Queryable = Pick<DbPool, "query">;

interface CandidateRow {
  item_id?: string;
  set_id?: string;
  candidate_json: unknown;
}

interface V5SetDoc {
  identity: { set_id: string; title: string };
  atlas_target: { primary_outline_code: string | null; subject: string };
  delivery?: { estimated_minutes?: number };
  composition: {
    sequence: Array<{
      step_id: string;
      item_id?: string | null;
      role: string;
      required: boolean;
      order_index: number;
    }>;
  };
}

interface V5ItemDoc {
  identity: { item_id: string; title: string; item_type: string };
  source?: { source_section_id?: string | null };
  atlas: { primary_outline_code: string | null };
  content: {
    prompt: string;
    front_blocks?: Array<{
      type: string;
      markdown?: string | null;
      alt_text?: string | null;
      caption?: string | null;
    }>;
  };
  task?: { options?: Array<{ id: string; label: string }> };
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("candidate_json must be an object");
}

function itemPreview(item: V5ItemDoc): LeadMeV5ItemPreview {
  return {
    item_id: item.identity.item_id,
    item_type: item.identity.item_type,
    title: item.identity.title,
    prompt: item.content.prompt,
    front_blocks: item.content.front_blocks ?? [],
    options: item.task?.options ?? [],
  };
}

export function buildLeadMeV5AssaultManifest(input: {
  set: V5SetDoc;
  items: V5ItemDoc[];
}): DayPlanManifest {
  const itemById = new Map(input.items.map((item) => [item.identity.item_id, item]));
  const steps: DayPlanStep[] = input.set.composition.sequence
    .filter((entry) => entry.item_id && itemById.has(entry.item_id))
    .sort((a, b) => a.order_index - b.order_index)
    .map((entry, index) => {
      const item = itemById.get(entry.item_id as string)!;
      return {
        step_id: `leadme-v5-${item.identity.item_id.toLowerCase()}`,
        order: index + 1,
        main_item_id: "leadme-v5-assault",
        kind: item.identity.item_type === "red_zone_bridge" ? "trap_repair" : "lesson_slice",
        title: item.identity.title,
        prompt: item.content.prompt,
        estimated_seconds: Math.max(
          45,
          Math.round(((input.set.delivery?.estimated_minutes ?? 5) * 60) / Math.max(input.items.length, 1)),
        ),
        content_ref: {
          type: "leadme_v5_candidate",
          id: item.identity.item_id,
          label: item.source?.source_section_id ?? item.identity.title,
        },
        action: { label: "Work this card" },
        xp: 10,
        leadme_v5_item: itemPreview(item),
      };
    });

  return {
    plan_key: "leadme-v5-assault-live-test",
    version: "5.0.0",
    day_index: 1,
    title: input.set.identity.title,
    approved: true,
    approved_at: new Date(0).toISOString(),
    timezone: "America/Los_Angeles",
    rollover_hour: 3,
    main_items: [
      {
        main_item_id: "leadme-v5-assault",
        order: 1,
        title: input.set.identity.title,
        description: "Live V5 test module for Assault: apprehension, imminence, apparent ability, and wrong-answer repair.",
        selectable: false,
        step_count: steps.length,
      },
    ],
    steps,
  };
}

export async function readLeadMeV5AssaultManifest(
  db: Queryable,
): Promise<DayPlanManifest | null> {
  const { rows: setRows } = await db.query<CandidateRow>(
    `SELECT set_id, candidate_json
       FROM leadme_v5_set_candidates
      WHERE set_id = $1
        AND validation_status = 'passed'
        AND status = 'candidate'
      LIMIT 1`,
    [LEADME_V5_ASSAULT_SET_ID],
  );
  const setRow = setRows[0];
  if (!setRow) return null;

  const setDoc = asObject(setRow.candidate_json) as unknown as V5SetDoc;
  const itemIds = setDoc.composition.sequence
    .map((entry) => entry.item_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (itemIds.length === 0) return null;

  const placeholders = itemIds.map((_id, index) => `$${index + 1}`).join(", ");
  const { rows: itemRows } = await db.query<CandidateRow>(
    `SELECT item_id, candidate_json
       FROM leadme_v5_item_candidates
      WHERE item_id IN (${placeholders})
        AND validation_status = 'passed'
        AND status = 'candidate'`,
    itemIds,
  );
  const items = itemRows.map((row) => asObject(row.candidate_json) as unknown as V5ItemDoc);
  return buildLeadMeV5AssaultManifest({ set: setDoc, items });
}
