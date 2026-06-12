// CQ batch ingestion generator — C:\CCG\Finished (Pass-1 + Pass-2 five-block format).
//
// Commands (run via: npx tsx src/scripts/generate-cq-batch.ts <command> [sourceDir] [outDir]):
//   qa     — parse + validate every CQ*.md, write qa-report.json/md with PASS/QUARANTINE
//   sql    — emit cq-batch.sql (questions + answer_choices + question_tags upserts) for PASS files
//   packs  — emit per-subject pack JSON (cards, keys, drills, microdrills, manifest) for PASS files
//   all    — qa + sql + packs
//
// Follows the ambassador-diagnostic pattern: deterministic UUIDs, ON DUPLICATE KEY UPDATE,
// never touches a database. Focus-group rows are NOT emitted: batch pick rates are
// provenance "predicted" or "inherited" (carried from the original question's measured
// row via the letter map), and focus_group_response_data holds measured rates only.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

const DEFAULT_SOURCE_DIR = "C:/CCG/Finished";
const DEFAULT_OUT_DIR = "C:/barmatrix-api/tasks/cq-batch-2026-06-12";
const OUTLINE_MAP_PATH = "C:/CCG/OUTLINE_CODES_COMPLETE.md";

const LETTERS = ["A", "B", "C", "D"] as const;
type Letter = (typeof LETTERS)[number];

const SUBJECT_DIRS: Record<string, string> = {
  CONTRACTS: "contracts",
  TORTS: "torts",
  CONSTITUTIONAL_LAW: "conlaw",
  CIVIL_PROCEDURE: "civpro",
  EVIDENCE: "evidence",
  CRIMINAL: "criminal",
  CRIMINAL_LAW: "criminal",
  REAL_PROPERTY: "rp",
};

const DIFFICULTY_BAND: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

interface JsonRecord {
  [key: string]: unknown;
}

interface CqChoice {
  letter: Letter;
  text: string;
  is_correct: boolean;
  mold_code: string | null;
  filter_broken: string | null;
  architecture: string | null;
  student_label: string | null;
  c3_signal: string | null;
  why_attractive: string | null;
  why_wrong_or_correct: string | null;
  future_cue: string | null;
  forensic_tags: string[];
}

interface CqKey {
  id: string;
  statement: string;
  type: string | null;
  trigger: string | null;
  authority: string | null;
  last_minute_review: boolean;
}

interface CqDrillSeed {
  drill_type: string;
  target_skill: string;
  prompt: string;
  answer: string;
}

interface CqQuestion {
  source_file: string;
  qid: string; // external_id, e.g. "20556_mustard_seed_puppet_caravan"
  subject: string;
  subject_dir: string;
  topic: string | null;
  subtopic: string | null;
  outline_code: string | null;
  outline_code_verified: boolean; // true only when the code appears in OUTLINE_CODES_COMPLETE.md
  tension_axis: string | null;
  splitting_fact: string | null;
  deciding_phase: string | null;
  confidence: string | null;
  difficulty_band: string;
  difficulty: number;
  stem: string;
  call: string;
  correct: Letter;
  transformed_from: string | null;
  variant_slug: string | null;
  distilled_core_question: string | null;
  review_truth: string | null;
  dominant_trap: string | null;
  choices: CqChoice[];
  remediation_card: JsonRecord | null;
  gold_keys: CqKey[];
  silver_keys: CqKey[];
  forensic_tags: string[];
  misconception_tags: string[];
  drill_seeds: CqDrillSeed[];
  warnings: string[];
  notes: string[];
}

interface ParseFailure {
  source_file: string;
  reasons: string[];
}

// ---------------------------------------------------------------------------
// helpers

function stableUuid(seed: string): string {
  const chars = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  const variant = (Number.parseInt(chars[16] ?? "0", 16) & 0x3) | 0x8;
  chars[16] = variant.toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return sqlString(JSON.stringify(value));
}

function isLetter(value: unknown): value is Letter {
  return typeof value === "string" && (LETTERS as readonly string[]).includes(value);
}

function str(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function rec(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function strArr(value: unknown): string[] {
  return arr(value)
    .map((item) => str(item))
    .filter((item): item is string => item !== null);
}

/** Depth-first search for the first non-empty string under any of the given keys. */
function deepString(value: unknown, keys: string[], depth = 0): string | null {
  if (depth > 6) return null;
  const record = rec(value);
  if (!record) return null;
  for (const key of keys) {
    const direct = str(record[key]);
    if (direct) return direct;
  }
  for (const child of Object.values(record)) {
    const found = deepString(child, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

/** The dominant-trap field drifted across emitter generations: answer_array.dominant_trap
 *  (mapping with choice / new_choice / pedagogical, or a bare value), frontmatter/doc-level
 *  dominant_trap, dominant_trap_candidate, analytics_hooks.dominant_trap_choice, or
 *  predicted_dominant_trap. dominant_trap_status / dominant_trap_note are prose explaining
 *  that no measured trap was supplied — deliberately NOT treated as a name. */
function findDominantTrap(value: unknown, depth = 0): string | null {
  if (depth > 6) return null;
  const record = rec(value);
  if (!record) return null;
  const keys = ["dominant_trap", "dominant_trap_candidate", "dominant_trap_choice", "predicted_dominant_trap"];
  for (const key of keys) {
    const raw = record[key];
    const direct = str(raw);
    if (direct) return direct;
    const inner = rec(raw);
    const choice = str(inner?.choice) ?? str(inner?.new_choice) ?? str(inner?.pedagogical);
    if (choice) return choice;
  }
  for (const child of Object.values(record)) {
    const found = findDominantTrap(child, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Some emitter generations leave unquoted scalars containing ": ", which the YAML
 *  spec reads as a nested compact mapping. Quote those values and retry. */
function sanitizeYaml(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      // stray trailing comma after a closing quote (JSON habit): - "...", / key: "...",
      const trailingComma = line.match(/^(\s*(?:- |[A-Za-z_][A-Za-z0-9_]*: )".*"),\s*$/);
      if (trailingComma) return trailingComma[1] as string;
      // trailing text after a closed quote: key: "..." (note) — re-quote whole value
      const afterQuote = line.match(/^(\s*(?:- )?[A-Za-z_][A-Za-z0-9_]*:)\s+"(.*)"(\s+\S.*)$/);
      if (afterQuote) {
        const value = `${afterQuote[2]}${afterQuote[3]}`;
        return `${afterQuote[1]} "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      }
      // unquoted scalar containing ": " (compact-mapping error), incl. list items
      const match = line.match(/^(\s*(?:- )?[A-Za-z_][A-Za-z0-9_]*:)\s+([^"'|>#\n].*: .*)$/);
      if (!match) return line;
      const value = (match[2] ?? "").trim();
      if (/^[\d.]+$/.test(value)) return line;
      return `${match[1]} "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    })
    .join("\n");
}

/** Repair "key: scalar" lines that are followed by a deeper-indented child mapping
 *  (invalid YAML): move the scalar into a `_value` child. Last-resort pass. */
function repairOrphanChildren(source: string): string {
  const lines = source.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    const match = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*):\s+(\S.*)$/);
    const next = lines[i + 1] ?? "";
    const indent = match ? (match[1] as string).length : 0;
    const nextIndent = next.match(/^\s*/)?.[0].length ?? 0;
    if (match && next.trim().length > 0 && nextIndent > indent && /^\s*[A-Za-z_-]/.test(next) && next.includes(":")) {
      out.push(`${match[1]}${match[2]}:`);
      out.push(`${match[1]}  _value: ${match[3]}`);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

/** Extract a Pass-1 markdown section body by header text (e.g. "Final question",
 *  "Full right-answer explanation"). */
function markdownSection(markdown: string, header: string): string | null {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const re = new RegExp(`^#{1,4}\\s*(?:\\d+[.)]\\s*)?${header}[^\\n]*\\n([\\s\\S]*?)(?=^#{1,4}\\s|^---\\s*$)`, "im");
  const body = normalized.match(re)?.[1];
  if (!body) return null;
  const cleaned = body.replace(/\*\*/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Valid 8-digit outline codes from OUTLINE_CODES_COMPLETE.md (catalog lines look like
 *  "        52040300  Gap-Fillers, Interpretation, and the Parol Evidence Rule > Parol Evidence Rule").
 *  Returns null when the map file is absent so callers can fall back to "unverified". */
let outlineCodesCache: Set<string> | null | undefined;
function outlineCodes(): Set<string> | null {
  if (outlineCodesCache !== undefined) return outlineCodesCache;
  if (!existsSync(OUTLINE_MAP_PATH)) {
    outlineCodesCache = null;
    return null;
  }
  const codes = new Set<string>();
  for (const line of readFileSync(OUTLINE_MAP_PATH, "utf8").split("\n")) {
    const match = line.match(/^\s*(\d{8})\s+\S/);
    if (match) codes.add(match[1] as string);
  }
  outlineCodesCache = codes.size > 0 ? codes : null;
  return outlineCodesCache;
}

function normalizeSubject(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (raw === "CRIMINAL" || raw === "CRIMINAL_LAW_PROCEDURE") return "CRIMINAL_LAW";
  return raw;
}

// ---------------------------------------------------------------------------
// fence extraction

interface Fences {
  yaml: string | null;
  jsons: JsonRecord[];
}

function extractFences(markdown: string): Fences {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const fenceRe = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
  let yamlBlock: string | null = null;
  const jsons: JsonRecord[] = [];
  for (const match of normalized.matchAll(fenceRe)) {
    const lang = (match[1] ?? "").toLowerCase();
    const body = match[2] ?? "";
    const trimmed = body.trim();
    if (lang === "yaml" || (lang === "" && /^barmatrix_row:/m.test(trimmed))) {
      if (!yamlBlock) yamlBlock = body;
      continue;
    }
    if (lang === "json" || (lang === "" && trimmed.startsWith("{"))) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const record = rec(parsed);
        if (record) jsons.push(record);
      } catch {
        // invalid JSON fence — reported by the QA layer via missing-block checks
      }
    }
  }
  return { yaml: yamlBlock, jsons };
}

/** Identify the three Pass-2 JSON blocks by their distinguishing keys (block labels are
 *  sometimes omitted by the emitter, so we never rely on section headers). */
function classifyJsons(jsons: JsonRecord[]): {
  c3Annotation: JsonRecord | null;
  programElements: JsonRecord | null;
  programIntelligence: JsonRecord | null;
} {
  let c3Annotation: JsonRecord | null = null;
  let programElements: JsonRecord | null = null;
  let programIntelligence: JsonRecord | null = null;
  for (const record of jsons) {
    const inner =
      rec(record.c3_annotation) ?? rec(record.program_elements) ?? rec(record.program_intelligence);
    const target = inner ?? record;
    if (!c3Annotation && rec(target.c3)) {
      c3Annotation = target;
      continue;
    }
    if (!programIntelligence && (target.drill_seeds || target.wrong_answer_paths)) {
      programIntelligence = target;
      continue;
    }
    if (!programElements && (target.traps || target.remediation_card)) {
      programElements = target;
    }
  }
  return { c3Annotation, programElements, programIntelligence };
}

// ---------------------------------------------------------------------------
// parsing one file

function parseKeys(value: unknown): CqKey[] {
  return arr(value)
    .map((raw) => {
      const record = rec(raw);
      if (!record) return null;
      const id = str(record.id);
      const statement = str(record.statement);
      if (!id || !statement) return null;
      return {
        id,
        statement,
        type: str(record.type),
        trigger: str(record.trigger),
        authority: str(record.authority),
        last_minute_review: record.last_minute_review === true,
      } satisfies CqKey;
    })
    .filter((key): key is CqKey => key !== null);
}

function parseCqFile(markdown: string, sourceFile: string): CqQuestion {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const { yaml, jsons } = extractFences(markdown);

  if (!/PASS-1 TRANSFORM REPORT/i.test(markdown)) {
    warnings.push("Pass-1 transform report header not found (older header wording)");
  }
  if (!yaml) reasons.push("missing B1 question YAML block");

  const { c3Annotation, programElements, programIntelligence } = classifyJsons(jsons);
  if (!c3Annotation) reasons.push("missing/unparseable B3 c3_annotation JSON block");
  if (!programElements) reasons.push("missing/unparseable B4 program_elements JSON block");
  if (!programIntelligence) reasons.push("missing/unparseable B5 program_intelligence JSON block");
  if (!/PASS-2 BLOCK 2|17-section student case study/i.test(markdown)) {
    warnings.push("B2 student case study header not found");
  }
  if (reasons.length > 0) throw new QuarantineError(sourceFile, reasons);

  let doc: JsonRecord;
  try {
    doc = (parseYaml(yaml as string, { uniqueKeys: false }) ?? {}) as JsonRecord;
  } catch {
    try {
      doc = (parseYaml(sanitizeYaml(yaml as string), { uniqueKeys: false }) ?? {}) as JsonRecord;
      warnings.push("B1 YAML required sanitization (unquoted ': ' scalars)");
    } catch {
      try {
        doc = (parseYaml(repairOrphanChildren(sanitizeYaml(yaml as string)), { uniqueKeys: false }) ?? {}) as JsonRecord;
        warnings.push("B1 YAML required orphan-child repair");
      } catch (err) {
        throw new QuarantineError(sourceFile, [
          `B1 YAML failed to parse: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`,
        ]);
      }
    }
  }

  // some emitter generations wrap the whole document in question_yaml / question_yaml_v2
  doc = rec(doc.question_yaml) ?? rec(doc.question_yaml_v2) ?? doc;
  const row = rec(doc.barmatrix_row) ?? rec(doc.question);
  if (!row) throw new QuarantineError(sourceFile, ["B1 YAML missing barmatrix_row"]);
  const c3 = rec(c3Annotation!.c3);

  // canonical qid is "<source-number>_<variant_slug>"; internal_id values like
  // "CR-100" are NOT unique across the bank and must never become external_id
  const provenanceEarly = rec(doc.transform_provenance);
  let qid =
    str(row.qid) ??
    str(row.question_id) ??
    str(row.original_qid) ??
    str(doc.question_id) ??
    deepString(row, ["qid", "question_id", "original_qid"]);
  if (qid && !/^\d{4,}_/.test(qid)) {
    const num =
      str(provenanceEarly?.transformed_from)?.match(/\d{4,}/)?.[0] ??
      qid.match(/\d{4,}/)?.[0] ??
      sourceFile.match(/\d{4,}/)?.[0];
    const slug = str(provenanceEarly?.variant_slug);
    if (num) qid = slug ? `${num}_${slug}` : num;
  }
  const subject = normalizeSubject(str(row.subject) ?? deepString(doc, ["subject"]));
  const call = str(row.call) ?? deepString(row, ["call", "call_of_question"]);

  // stem: B1 direct → nested (some generations wrap it in a sub-map) → Pass-1 markdown §1
  let stem =
    str(row.stem) ?? deepString(row, ["stem", "revised_stem", "final_stem", "transformed_stem"]);
  if (!stem) {
    const section = markdownSection(markdown, "(?:1[.)]?\\s*)?Final question");
    if (section) {
      stem = call ? section.replace(call.replace(/\*\*/g, ""), "").trim() : section;
      warnings.push("stem recovered from Pass-1 markdown (absent in B1 YAML)");
    }
  }

  const choicesRec = rec(row.choices) ?? rec(row.answer_choices);
  const choiceText = (letter: Letter): string | null => {
    const raw = choicesRec?.[letter];
    return str(raw) ?? str(rec(raw)?.text) ?? str(rec(raw)?.choice_text);
  };
  const officialKey =
    (str(row.official_key) ?? str(c3?.credited_answer) ?? deepString(doc, ["official_key", "credited_answer"]))
      ?.charAt(0) ?? "";

  if (!qid) reasons.push("missing barmatrix_row.qid");
  if (!subject) reasons.push("missing barmatrix_row.subject");
  if (subject && !SUBJECT_DIRS[subject]) reasons.push(`unknown subject: ${subject}`);
  if (!stem || stem.length < 80) reasons.push("missing or implausibly short stem");
  if (!call) reasons.push("missing call");
  if (!isLetter(officialKey)) reasons.push("official_key is not A-D");
  for (const letter of LETTERS) {
    if (!choiceText(letter)) reasons.push(`missing choice ${letter}`);
  }
  if (reasons.length > 0) throw new QuarantineError(sourceFile, reasons);

  const correct = officialKey as Letter;
  const provenance = rec(doc.transform_provenance);
  const routing = rec(doc.c3_routing);
  const walkthroughs = rec(doc.choice_walkthroughs);
  const residual = rec(doc.residual_answer);
  const analyticsHooks = rec(doc.analytics_hooks);

  const b3Distractors = new Map<string, JsonRecord>();
  for (const raw of arr(c3?.distractors)) {
    const record = rec(raw);
    const choice = str(record?.choice);
    if (record && choice) b3Distractors.set(choice, record);
  }

  const b4Traps = new Map<string, JsonRecord>();
  for (const raw of arr(programElements!.traps)) {
    const record = rec(raw);
    const choice = str(record?.choice);
    if (record && choice) b4Traps.set(choice, record);
  }

  const b5Paths = new Map<string, JsonRecord>();
  for (const raw of arr(programIntelligence!.wrong_answer_paths)) {
    const record = rec(raw);
    const choice = str(record?.choice);
    if (record && choice) b5Paths.set(choice, record);
  }

  const dominantTrap = findDominantTrap(doc);
  if (!dominantTrap) warnings.push("dominant trap not named");

  // pick-rate honesty: measured rates must not exist in this batch. "inherited" rates
  // (carried from the original question's measured row via the letter map) are allowed
  // but stay out of focus_group_response_data — informational note, not a warning.
  const pcts = rec(row.selection_percentages);
  for (const letter of LETTERS) {
    const cell = rec(pcts?.[letter]);
    if (!cell || cell.value === null || cell.value === undefined) continue;
    const cellProvenance = str(cell.provenance);
    if (cellProvenance === "predicted") continue;
    if (cellProvenance === "inherited") {
      notes.push(`selection_percentages.${letter} is inherited from the original question's measured row — kept out of focus_group_response_data`);
    } else {
      warnings.push(`selection_percentages.${letter} claims a non-predicted measured rate — review before any focus-group load`);
    }
  }

  // some emitter generations put outline_code only in analytics_hooks / silver-key maps
  const outlineCode = str(row.outline_code) ?? deepString(doc, ["outline_code"]);
  let outlineCodeVerified = false;
  if (outlineCode && outlineCode !== "00000000") {
    const validCodes = outlineCodes();
    if (!validCodes) {
      warnings.push(`outline_code ${outlineCode} is unverified (outline map not found at ${OUTLINE_MAP_PATH}) — stored as metadata only`);
    } else if (validCodes.has(outlineCode)) {
      outlineCodeVerified = true;
    } else {
      warnings.push(`outline_code ${outlineCode} not found in ${path.basename(OUTLINE_MAP_PATH)} — stored as metadata only`);
    }
  }

  const choices: CqChoice[] = LETTERS.map((letter) => {
    const isCorrect = letter === correct;
    const walk = rec(walkthroughs?.[letter]);
    const b3 = b3Distractors.get(letter) ?? null;
    const b4 = b4Traps.get(letter) ?? null;
    const b5 = b5Paths.get(letter) ?? null;
    const mold = isCorrect ? null : (str(walk?.mold_code) ?? str(b3?.mold) ?? str(b4?.mold));
    const architecture = isCorrect
      ? null
      : (str(walk?.bait_architecture_code) ?? str(b3?.architecture) ?? str(b4?.architecture));
    const whyAttractive = isCorrect ? null : str(b4?.why_attractive);
    // residual explanation field name drifted across emitter generations
    const residualWhy =
      str(residual?.explanation) ??
      str(residual?.reason) ??
      str(residual?.why_residual) ??
      str(residual?.why_it_survives) ??
      str(residual?.why) ??
      markdownSection(markdown, "(?:7[.)]?\\s*)?Full right-answer explanation");
    const whyWrongOrCorrect = isCorrect ? residualWhy : (str(b3?.explanation) ?? null);
    const futureCue = isCorrect ? null : str(b5?.recovery_step);

    if (!isCorrect) {
      if (!mold) reasons.push(`choice ${letter}: missing mold_code`);
      if (!whyAttractive) reasons.push(`choice ${letter}: missing why_attractive (B4)`);
      if (!whyWrongOrCorrect) reasons.push(`choice ${letter}: missing distractor explanation (B3)`);
      if (!futureCue) warnings.push(`choice ${letter}: missing recovery_step (B5)`);
    } else if (!whyWrongOrCorrect) {
      reasons.push("missing residual_answer.explanation for correct choice");
    }

    const tags = [mold, architecture].filter((tag): tag is string => tag !== null);
    return {
      letter,
      text: choiceText(letter) as string,
      is_correct: isCorrect,
      mold_code: mold,
      filter_broken: isCorrect ? null : str(walk?.filter_broken),
      architecture,
      student_label: str(walk?.student_label),
      c3_signal: str(walk?.c3_signal),
      why_attractive: whyAttractive,
      why_wrong_or_correct: whyWrongOrCorrect,
      future_cue: futureCue,
      forensic_tags: [...new Set(tags)],
    };
  });
  if (reasons.length > 0) throw new QuarantineError(sourceFile, reasons);

  const difficultyBand = str(routing?.difficulty)?.toLowerCase() ?? "medium";
  const difficulty = difficultyBand.includes("hard")
    ? 3
    : difficultyBand.includes("easy")
      ? 1
      : (DIFFICULTY_BAND[difficultyBand] ?? 2);
  const trapTags = rec(programIntelligence!.trap_tags);
  const tension = rec(programElements!.tension);
  const drillSeeds: CqDrillSeed[] = arr(programIntelligence!.drill_seeds)
    .map((raw) => {
      const record = rec(raw);
      const drillType = str(record?.drill_type);
      const prompt = str(record?.prompt);
      const answer = str(record?.answer);
      if (!record || !drillType || !prompt || !answer) return null;
      return {
        drill_type: drillType,
        target_skill: str(record.target_skill) ?? "general",
        prompt,
        answer,
      } satisfies CqDrillSeed;
    })
    .filter((seed): seed is CqDrillSeed => seed !== null);
  if (drillSeeds.length === 0) warnings.push("no usable drill_seeds in B5");

  return {
    source_file: sourceFile,
    qid: qid as string,
    subject: subject as string,
    subject_dir: SUBJECT_DIRS[subject as string] as string,
    topic: str(row.topic),
    subtopic: str(row.subtopic),
    outline_code: outlineCode,
    outline_code_verified: outlineCodeVerified,
    tension_axis: str(routing?.tension_axis) ?? str(tension?.axis),
    splitting_fact: str(tension?.splitting_fact),
    deciding_phase: str(routing?.deciding_phase),
    confidence: str(routing?.confidence),
    difficulty_band: difficultyBand,
    difficulty,
    stem: stem as string,
    call: call as string,
    correct,
    transformed_from: str(provenance?.transformed_from),
    variant_slug: str(provenance?.variant_slug),
    distilled_core_question: str(doc.distilled_core_question) ?? str(c3Annotation!.distilled_core_question),
    review_truth: str(doc.review_truth) ?? str(c3Annotation!.review_truth),
    dominant_trap: dominantTrap,
    choices,
    remediation_card: rec(doc.remediation) ?? rec(programElements!.remediation_card),
    gold_keys: parseKeys(doc.gold_keys ?? c3?.gold_keys),
    silver_keys: parseKeys(doc.silver_keys ?? c3?.silver_keys),
    forensic_tags: strArr(trapTags?.forensic_tags ?? rec(analyticsHooks)?.trap_tags),
    misconception_tags: strArr(trapTags?.misconception_tags),
    drill_seeds: drillSeeds,
    warnings,
    notes,
  };
}

class QuarantineError extends Error {
  reasons: string[];
  constructor(sourceFile: string, reasons: string[]) {
    super(`${sourceFile}: ${reasons.join("; ")}`);
    this.reasons = reasons;
  }
}

// ---------------------------------------------------------------------------
// batch load

interface BatchResult {
  passed: CqQuestion[];
  quarantined: ParseFailure[];
}

function loadBatch(sourceDir: string): BatchResult {
  if (!existsSync(sourceDir)) throw new Error(`source directory not found: ${sourceDir}`);
  const files = readdirSync(sourceDir)
    .filter((name) => /^CQ\d+\.md$/i.test(name))
    .sort();
  const passed: CqQuestion[] = [];
  const quarantined: ParseFailure[] = [];
  const seenQids = new Map<string, string>();
  for (const file of files) {
    try {
      const question = parseCqFile(readFileSync(path.join(sourceDir, file), "utf8"), file);
      const dup = seenQids.get(question.qid);
      if (dup) {
        quarantined.push({ source_file: file, reasons: [`duplicate qid ${question.qid} (already in ${dup})`] });
        continue;
      }
      seenQids.set(question.qid, file);
      passed.push(question);
    } catch (err) {
      if (err instanceof QuarantineError) {
        quarantined.push({ source_file: file, reasons: err.reasons });
      } else {
        quarantined.push({
          source_file: file,
          reasons: [`unexpected parse error: ${err instanceof Error ? err.message : String(err)}`],
        });
      }
    }
  }
  return { passed, quarantined };
}

// ---------------------------------------------------------------------------
// outputs

function writeQaReport(batch: BatchResult, outDir: string): void {
  const bySubject = new Map<string, number>();
  for (const question of batch.passed) {
    bySubject.set(question.subject, (bySubject.get(question.subject) ?? 0) + 1);
  }
  const warningRows = batch.passed
    .filter((question) => question.warnings.length > 0)
    .map((question) => ({ source_file: question.source_file, qid: question.qid, warnings: question.warnings }));
  const noteRows = batch.passed
    .filter((question) => question.notes.length > 0)
    .map((question) => ({ source_file: question.source_file, qid: question.qid, notes: question.notes }));

  const report = {
    generated_at_source: "run `git log -1` in barmatrix-api for the generation commit",
    source_count: batch.passed.length + batch.quarantined.length,
    pass_count: batch.passed.length,
    quarantine_count: batch.quarantined.length,
    subjects: Object.fromEntries([...bySubject.entries()].sort()),
    quarantined: batch.quarantined,
    warnings: warningRows,
    notes: noteRows,
    passed: batch.passed.map((question) => ({
      source_file: question.source_file,
      qid: question.qid,
      subject: question.subject,
      correct: question.correct,
      difficulty_band: question.difficulty_band,
      tension_axis: question.tension_axis,
      dominant_trap: question.dominant_trap,
      gold_keys: question.gold_keys.map((key) => key.id),
      silver_keys: question.silver_keys.map((key) => key.id),
      drill_seed_count: question.drill_seeds.length,
    })),
  };
  writeFileSync(path.join(outDir, "qa-report.json"), JSON.stringify(report, null, 2), "utf8");

  const lines = [
    "# CQ Batch QA Report",
    "",
    `Files scanned: ${report.source_count}  ·  PASS: ${report.pass_count}  ·  QUARANTINE: ${report.quarantine_count}`,
    "",
    "## Subjects (PASS)",
    "",
    ...[...bySubject.entries()].sort().map(([subject, count]) => `- ${subject}: ${count}`),
    "",
    "## Quarantined",
    "",
    ...(batch.quarantined.length === 0
      ? ["(none)"]
      : batch.quarantined.map((failure) => `- **${failure.source_file}** — ${failure.reasons.join("; ")}`)),
    "",
    "## Warnings (PASS files, non-blocking)",
    "",
    ...(warningRows.length === 0
      ? ["(none)"]
      : warningRows.map((row) => `- **${row.source_file}** (${row.qid}): ${row.warnings.join("; ")}`)),
    "",
    "## Informational notes (PASS files)",
    "",
    ...(noteRows.length === 0
      ? ["(none)"]
      : noteRows.map((row) => `- **${row.source_file}** (${row.qid}): ${row.notes.join("; ")}`)),
    "",
  ];
  writeFileSync(path.join(outDir, "qa-report.md"), lines.join("\n"), "utf8");
}

function questionMetadata(question: CqQuestion): JsonRecord {
  return {
    source_file: question.source_file,
    source_question_id: question.transformed_from,
    variant_slug: question.variant_slug,
    batch: "cq-2026-06-12",
    outline_code: question.outline_code,
    outline_code_verified: question.outline_code_verified,
    difficulty_band: question.difficulty_band,
    deciding_phase: question.deciding_phase,
    confidence: question.confidence,
    splitting_fact: question.splitting_fact,
    distilled_core_question: question.distilled_core_question,
    review_truth: question.review_truth,
    dominant_trap: question.dominant_trap,
    anchor_card: question.remediation_card,
    gold_keys: question.gold_keys,
    silver_keys: question.silver_keys,
    drill_seeds: question.drill_seeds,
  };
}

function buildSql(questions: CqQuestion[]): string {
  const questionRows = questions.map((question) =>
    [
      sqlString(stableUuid(`cq-batch-question:${question.qid}`)),
      sqlString(question.qid),
      sqlString(question.subject),
      sqlString(question.topic),
      sqlString(question.subtopic),
      sqlString(question.tension_axis),
      sqlString(question.stem),
      sqlString(`${question.stem}\n\n${question.call}`),
      sqlString(question.call),
      String(question.difficulty),
      "'active'",
      "'ccg_transform'",
      "1",
      sqlJson(questionMetadata(question)),
    ].join(", "),
  );

  const choiceRows = questions.flatMap((question) =>
    question.choices.map((choice) =>
      [
        sqlString(stableUuid(`cq-batch-choice:${question.qid}:${choice.letter}`)),
        `(SELECT question_id FROM questions WHERE external_id = ${sqlString(question.qid)})`,
        sqlString(choice.letter),
        sqlString(choice.text),
        choice.is_correct ? "1" : "0",
        sqlJson(choice.forensic_tags),
        sqlJson(question.misconception_tags.length > 0 && !choice.is_correct ? question.misconception_tags : []),
        sqlString(choice.why_attractive),
        sqlString(choice.why_wrong_or_correct),
        sqlString(choice.future_cue),
        sqlString(str(question.remediation_card?.card_id) ?? str(question.remediation_card?.id)),
      ].join(", "),
    ),
  );

  const tagRows = questions.flatMap((question) => {
    const rows: string[] = [];
    // resolve question_id by external_id (like answer_choices) so a pre-existing
    // row with the same external_id can never break the FK
    const push = (dimension: string, value: string, metadata: JsonRecord = {}) => {
      rows.push(
        [
          `(SELECT question_id FROM questions WHERE external_id = ${sqlString(question.qid)})`,
          sqlString(dimension),
          sqlString(value.slice(0, 255)),
          sqlJson(metadata),
        ].join(", "),
      );
    };
    if (question.tension_axis) push("tension", slugify(question.tension_axis), { label: question.tension_axis });
    for (const tag of question.forensic_tags) push("trap_family", tag);
    for (const tag of question.misconception_tags) push("misconception", tag);
    for (const key of question.gold_keys) push("gold_key", key.id, { last_minute_review: key.last_minute_review });
    for (const key of question.silver_keys) push("silver_key", key.id, { last_minute_review: key.last_minute_review });
    push("difficulty_band", question.difficulty_band);
    return rows;
  });

  return [
    "-- CQ batch 2026-06-12 — generated from C:/CCG/Finished by generate-cq-batch.ts.",
    "-- Idempotent upserts. Focus-group rows intentionally absent (predicted rates only in this batch).",
    "START TRANSACTION;",
    "",
    "INSERT INTO questions",
    "  (question_id, external_id, subject, topic, subtopic, tension_point, fact_pattern, question_stem, call_of_question, difficulty, status, source_type, version, metadata)",
    "VALUES",
    questionRows.map((row) => `  (${row})`).join(",\n"),
    "ON DUPLICATE KEY UPDATE",
    "  subject = VALUES(subject),",
    "  topic = VALUES(topic),",
    "  subtopic = VALUES(subtopic),",
    "  tension_point = VALUES(tension_point),",
    "  fact_pattern = VALUES(fact_pattern),",
    "  question_stem = VALUES(question_stem),",
    "  call_of_question = VALUES(call_of_question),",
    "  difficulty = VALUES(difficulty),",
    "  status = VALUES(status),",
    "  source_type = VALUES(source_type),",
    "  version = VALUES(version),",
    "  metadata = VALUES(metadata);",
    "",
    "INSERT INTO answer_choices",
    "  (choice_id, question_id, letter, choice_text, is_correct, forensic_tags, misconception_tags, why_attractive, why_wrong_or_correct, future_cue, remediation_id)",
    "VALUES",
    choiceRows.map((row) => `  (${row})`).join(",\n"),
    "ON DUPLICATE KEY UPDATE",
    "  choice_text = VALUES(choice_text),",
    "  is_correct = VALUES(is_correct),",
    "  forensic_tags = VALUES(forensic_tags),",
    "  misconception_tags = VALUES(misconception_tags),",
    "  why_attractive = VALUES(why_attractive),",
    "  why_wrong_or_correct = VALUES(why_wrong_or_correct),",
    "  future_cue = VALUES(future_cue),",
    "  remediation_id = VALUES(remediation_id);",
    "",
    "INSERT INTO question_tags",
    "  (question_id, dimension, value, metadata)",
    "VALUES",
    tagRows.map((row) => `  (${row})`).join(",\n"),
    "ON DUPLICATE KEY UPDATE",
    "  metadata = VALUES(metadata);",
    "",
    "COMMIT;",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// subject packs

function buildPacks(questions: CqQuestion[], outDir: string): string[] {
  const written: string[] = [];
  const byDir = new Map<string, CqQuestion[]>();
  for (const question of questions) {
    const list = byDir.get(question.subject_dir) ?? [];
    list.push(question);
    byDir.set(question.subject_dir, list);
  }

  for (const [dir, subjectQuestions] of [...byDir.entries()].sort()) {
    const packDir = path.join(outDir, "packs", dir);
    mkdirSync(packDir, { recursive: true });

    // cards: dedupe remediation cards by card_id, merge example_qids
    const cards = new Map<string, JsonRecord>();
    for (const question of subjectQuestions) {
      const card = question.remediation_card;
      const id = str(card?.card_id) ?? str(card?.id);
      if (!card || !id) continue;
      const existing = cards.get(id);
      if (existing) {
        (existing.example_qids as string[]).push(question.qid);
      } else {
        cards.set(id, {
          id,
          type: "ANCHOR",
          title: str(card.title),
          signal: str(card.signal),
          student_move: str(card.student_move),
          tiny_rule: str(card.tiny_rule),
          trap: str(card.trap),
          confidence: str(card.confidence),
          example_qids: [question.qid],
        });
      }
    }

    // keys: dedupe gold/silver by id, merge example_qids
    const keys = new Map<string, JsonRecord>();
    for (const question of subjectQuestions) {
      for (const [kind, list] of [
        ["gold", question.gold_keys],
        ["silver", question.silver_keys],
      ] as const) {
        for (const key of list) {
          const existing = keys.get(key.id);
          if (existing) {
            (existing.example_qids as string[]).push(question.qid);
          } else {
            keys.set(key.id, {
              id: key.id,
              kind,
              statement: key.statement,
              type: key.type,
              trigger: key.trigger,
              authority: key.authority,
              last_minute_review: key.last_minute_review,
              example_qids: [question.qid],
            });
          }
        }
      }
    }

    // drills: qid pools grouped by tension axis (>=2 questions) and trap family (>=3)
    const drills: JsonRecord[] = [];
    const byTension = new Map<string, CqQuestion[]>();
    for (const question of subjectQuestions) {
      if (!question.tension_axis) continue;
      const slug = slugify(question.tension_axis);
      const list = byTension.get(slug) ?? [];
      list.push(question);
      byTension.set(slug, list);
    }
    let drillIndex = 1;
    for (const [slug, pool] of [...byTension.entries()].sort()) {
      if (pool.length < 2) continue;
      drills.push({
        id: `DRILL-CQ-${dir.toUpperCase()}-T${String(drillIndex++).padStart(2, "0")}`,
        title: pool[0]?.tension_axis ?? slug,
        skill: "Tension recognition",
        task: `Work the ${pool.length}-question pool sharing this tension axis; name the splitting fact before answering.`,
        tension_slug: slug,
        qid_pool: pool.map((question) => question.qid),
        cards: [
          ...new Set(
            pool
              .map((question) => str(question.remediation_card?.card_id) ?? str(question.remediation_card?.id))
              .filter((id): id is string => id !== null),
          ),
        ],
        pass_criterion: `${Math.max(pool.length - 1, 1)}/${pool.length} correct with the splitting fact named.`,
      });
    }
    // trap-mold drills: group by per-choice mold_code (wrong_element, bait_doctrine,
    // tiered_absolute, ...) — bespoke one-question molds are filtered by the distinct-qid floor
    const byMold = new Map<string, Set<string>>();
    for (const question of subjectQuestions) {
      for (const choice of question.choices) {
        if (!choice.mold_code) continue;
        const pool = byMold.get(choice.mold_code) ?? new Set<string>();
        pool.add(question.qid);
        byMold.set(choice.mold_code, pool);
      }
    }
    let trapIndex = 1;
    for (const [mold, pool] of [...byMold.entries()].sort()) {
      if (pool.size < 3) continue;
      drills.push({
        id: `DRILL-CQ-${dir.toUpperCase()}-F${String(trapIndex++).padStart(2, "0")}`,
        title: `Trap mold: ${mold}`,
        skill: "Trap recognition",
        task: `Across ${pool.size} questions, identify which choice carries the "${mold}" mold before solving.`,
        trap_family: mold,
        qid_pool: [...pool].sort(),
        cards: [],
        pass_criterion: `Identify the trap choice in ${Math.max(pool.size - 1, 2)}/${pool.size} questions.`,
      });
    }

    // topic circuits: barmatrix_row.topic pools of 4+
    const byTopic = new Map<string, CqQuestion[]>();
    for (const question of subjectQuestions) {
      if (!question.topic) continue;
      const list = byTopic.get(question.topic) ?? [];
      list.push(question);
      byTopic.set(question.topic, list);
    }
    let topicIndex = 1;
    for (const [topic, pool] of [...byTopic.entries()].sort()) {
      if (pool.length < 4) continue;
      drills.push({
        id: `DRILL-CQ-${dir.toUpperCase()}-C${String(topicIndex++).padStart(2, "0")}`,
        title: `Topic circuit: ${topic}`,
        skill: "Mixed-call endurance",
        task: `Timed circuit across ${pool.length} ${topic} questions; predict the call before reading choices.`,
        topic,
        qid_pool: pool.map((question) => question.qid).sort(),
        cards: [
          ...new Set(
            pool
              .map((question) => str(question.remediation_card?.card_id) ?? str(question.remediation_card?.id))
              .filter((id): id is string => id !== null),
          ),
        ],
        pass_criterion: `${Math.ceil(pool.length * 0.75)}/${pool.length} correct with calls predicted.`,
      });
    }

    // micro-drills: one item per drill_seed
    const microdrills = subjectQuestions.flatMap((question) =>
      question.drill_seeds.map((seed, index) => ({
        id: `MICRO-${question.qid}-${index + 1}`,
        source_qid: question.qid,
        drill_type: seed.drill_type,
        target_skill: seed.target_skill,
        prompt: seed.prompt,
        answer: seed.answer,
        tension_slug: question.tension_axis ? slugify(question.tension_axis) : null,
        subject: question.subject,
      })),
    );

    const manifest = {
      subject_dir: dir,
      subject: subjectQuestions[0]?.subject,
      batch: "cq-2026-06-12",
      question_count: subjectQuestions.length,
      qids: subjectQuestions.map((question) => question.qid).sort(),
      cards: cards.size,
      keys: keys.size,
      drills: drills.length,
      microdrills: microdrills.length,
      note:
        dir === "criminal" || dir === "rp"
          ? "ADDITIVE to the existing subject pack — file names are suffixed .cq.json to avoid colliding with the legacy pack; merge is a deliberate API-side step."
          : "New subject pack — requires wiring into src/lib/c3-subjects.ts before it is served.",
    };

    const suffix = ".cq.json";
    const files: Array<[string, unknown]> = [
      [`${dir}_cards${suffix}`, [...cards.values()]],
      [`${dir}_keys${suffix}`, [...keys.values()]],
      [`${dir}_drills${suffix}`, drills],
      [`${dir}_microdrills${suffix}`, microdrills],
      [`${dir}_manifest${suffix}`, manifest],
    ];
    for (const [name, payload] of files) {
      const filePath = path.join(packDir, name);
      writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
      written.push(filePath);
    }
  }
  return written;
}

// ---------------------------------------------------------------------------
// main

function main(): void {
  const command = process.argv[2] ?? "all";
  const sourceDir = process.argv[3] ?? DEFAULT_SOURCE_DIR;
  const outDir = process.argv[4] ?? DEFAULT_OUT_DIR;
  mkdirSync(outDir, { recursive: true });

  const batch = loadBatch(sourceDir);

  if (command === "qa" || command === "all") {
    writeQaReport(batch, outDir);
    console.log(
      `qa: ${batch.passed.length} PASS / ${batch.quarantined.length} QUARANTINE → ${path.join(outDir, "qa-report.md")}`,
    );
  }
  if (command === "sql" || command === "all") {
    const sqlPath = path.join(outDir, "cq-batch.sql");
    writeFileSync(sqlPath, buildSql(batch.passed), "utf8");
    console.log(`sql: ${batch.passed.length} questions → ${sqlPath}`);
  }
  if (command === "packs" || command === "all") {
    const written = buildPacks(batch.passed, outDir);
    console.log(`packs: ${written.length} files under ${path.join(outDir, "packs")}`);
  }
  if (!["qa", "sql", "packs", "all"].includes(command)) {
    console.error(`unknown command: ${command} (use qa | sql | packs | all)`);
    process.exitCode = 1;
  }
}

main();
