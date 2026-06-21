import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { levelForScore, type PlacementLevel } from "./placement-level.js";
import type { DiagnosticAttemptRow, DiagnosticResults, TopTrapPattern } from "./diagnostic.js";

const LETTERS = ["A", "B", "C", "D"] as const;
type Letter = (typeof LETTERS)[number];

export const DEFAULT_AMBASSADOR_DIAGNOSTIC_SOURCE_DIR =
  process.env.AMBASSADOR_DIAGNOSTIC_SOURCE_DIR ||
  "C:/FOC/Workspace/Finished";

export const AMBASSADOR_DIAGNOSTIC_EXTERNAL_IDS = Array.from(
  { length: 20 },
  (_, index) => `DIAG-${String(index + 1).padStart(3, "0")}`,
);

export const AMBASSADOR_DIAGNOSTIC_SOURCE_FILES = [
  "CQ18018.md",
  "CQ19855.md",
  "CQ22620.md",
  "CQ19025.md",
  "CQ20657.md",
  "CQ20446.md",
  "CQ16014.md",
  "CQ21464.md",
  "CQ17089.md",
  "CQ14767.md",
  "CQ22108.md",
  "CQ20136.md",
  "CQ20236.md",
  "CQ15236.md",
  "CQ18017.md",
  "CQ19038.md",
  "CQ18771.md",
  "CQ17979_updated.md",
  "CQ17104.md",
  "CQ19498.md",
] as const;

export interface AmbassadorDiagnosticChoice {
  choice_id: string;
  letter: Letter;
  text: string;
  is_correct: boolean;
  filter_broken: string | null;
  mold_code: string | null;
  student_label: string | null;
  c3_signal: string | null;
  wrong_answer_recovery: string | null;
  forensic_tags: string[];
}

export interface AmbassadorAnchorCard {
  id: string;
  title: string | null;
  front: string | null;
  back: string | null;
}

export interface AmbassadorDiagnosticQuestion {
  question_id: string;
  external_id: string;
  source_file: string;
  source_question_id: string | null;
  subject: string;
  topic: string | null;
  subtopic: string;
  tension_point: string | null;
  difficulty: number;
  status: "diagnostic";
  fact_pattern: string;
  question_stem: string;
  call_of_question: string;
  correct_answer: Letter;
  choices: AmbassadorDiagnosticChoice[];
  anchor_card: AmbassadorAnchorCard | null;
  red_zone_dimensions: string[];
}

interface FixedDiagnosticQuestionSelection {
  sql: string;
  values: string[];
}

export interface DiagnosticRecommendation {
  level: PlacementLevel;
  top_leak: TopTrapPattern | null;
  next_step: {
    primary_label: string;
    href: string;
    copy: string;
  };
}

interface JsonRecord {
  [key: string]: unknown;
}

interface LetterMetadata {
  filter_broken?: string | null;
  mold_code?: string | null;
  student_label?: string | null;
  c3_signal?: string | null;
  is_correct?: boolean;
}

function isLetter(value: string): value is Letter {
  return (LETTERS as readonly string[]).includes(value);
}

function indentOf(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactBlockScalar(value: string, style: string): string {
  const cleaned = normalizeText(value);
  return style === ">" ? cleaned.replace(/\s*\n\s*/g, " ").trim() : cleaned;
}

function yamlFence(markdown: string): string {
  return markdown.match(/```yaml\s*([\s\S]*?)```/i)?.[1] ?? "";
}

function jsonFences(markdown: string): JsonRecord[] {
  return [...markdown.matchAll(/```json\s*([\s\S]*?)```/gi)]
    .map((match) => {
      try {
        return JSON.parse(match[1] ?? "{}") as JsonRecord;
      } catch {
        return {};
      }
    })
    .filter((record) => Object.keys(record).length > 0);
}

function normalizedSection(source: string, key: string): string | null {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const index = lines.findIndex((line) => line.trim().match(new RegExp(`^${key}:\\s*$`)));
  if (index < 0) return null;
  const parentIndent = indentOf(lines[index] ?? "");
  const baseIndent = parentIndent + 2;
  const body: string[] = [];
  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      body.push("");
      continue;
    }
    const indent = indentOf(line);
    if (indent <= parentIndent) break;
    body.push(line.length >= baseIndent ? line.slice(baseIndent) : line.trimStart());
  }
  return body.join("\n").trimEnd();
}

function readValueAt(lines: string[], index: number, key: string): string | null {
  const line = lines[index] ?? "";
  const match = line.trim().match(new RegExp(`^${key}:\\s*(.*)$`));
  if (!match) return null;
  const after = match[1]?.trim() ?? "";
  const indent = indentOf(line);

  if (after === "|" || after === ">") {
    const body: string[] = [];
    const baseIndent = indent + 2;
    for (let i = index + 1; i < lines.length; i += 1) {
      const child = lines[i] ?? "";
      if (child.trim() === "") {
        body.push("");
        continue;
      }
      const childIndent = indentOf(child);
      if (childIndent <= indent) break;
      body.push(child.length >= baseIndent ? child.slice(baseIndent) : child.trimStart());
    }
    return compactBlockScalar(body.join("\n"), after);
  }

  if (after === "") return null;
  return unquote(after);
}

function scalarFromSection(section: string | null, key: string): string | null {
  if (!section) return null;
  const lines = section.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const value = readValueAt(lines, i, key);
    if (value !== null && value !== "") return normalizeText(value);
  }
  return null;
}

function scalarAnywhere(source: string, key: string): string | null {
  return scalarFromSection(source, key);
}

function parseLetterMap(section: string | null): Partial<Record<Letter, string>> {
  if (!section) return {};
  const lines = section.replace(/\r\n/g, "\n").split("\n");
  const values: Partial<Record<Letter, string>> = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const match = line.trim().match(/^([A-D]):\s*(.*)$/);
    if (!match) continue;
    const matchedLetter = match[1] ?? "";
    if (!isLetter(matchedLetter)) continue;
    const letter = matchedLetter;
    if (values[letter]) continue;
    const after = match[2]?.trim() ?? "";
    if (after && after !== "|" && after !== ">") {
      values[letter] = normalizeText(unquote(after));
      continue;
    }
    if (after === "|" || after === ">") {
      values[letter] = readValueAt(lines, i, letter) ?? "";
      continue;
    }

    const letterSection = subsectionAt(lines, i);
    const text =
      scalarFromSection(letterSection, "text") ??
      scalarFromSection(letterSection, "revised_text") ??
      scalarFromSection(letterSection, "choice_text") ??
      scalarFromSection(letterSection, "original_text");
    if (text) values[letter] = text;
  }

  return values;
}

function subsectionAt(lines: string[], index: number): string {
  const parentIndent = indentOf(lines[index] ?? "");
  const baseIndent = parentIndent + 2;
  const body: string[] = [];
  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      body.push("");
      continue;
    }
    const indent = indentOf(line);
    if (indent <= parentIndent) break;
    body.push(line.length >= baseIndent ? line.slice(baseIndent) : line.trimStart());
  }
  return body.join("\n");
}

function parseLetterMetadata(section: string | null): Partial<Record<Letter, LetterMetadata>> {
  if (!section) return {};
  const lines = section.replace(/\r\n/g, "\n").split("\n");
  const values: Partial<Record<Letter, LetterMetadata>> = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const match = line.trim().match(/^([A-D]):\s*(.*)$/);
    if (!match) continue;
    const matchedLetter = match[1] ?? "";
    if (!isLetter(matchedLetter)) continue;
    const letter = matchedLetter;
    const letterSection = subsectionAt(lines, i);
    const credited = scalarFromSection(letterSection, "credited");
    const isCorrect = scalarFromSection(letterSection, "is_correct");
    values[letter] = {
      filter_broken: nullableScalar(
        scalarFromSection(letterSection, "filter_broken"),
      ),
      mold_code: nullableScalar(scalarFromSection(letterSection, "mold_code")),
      student_label:
        scalarFromSection(letterSection, "student_label") ??
        scalarFromSection(letterSection, "c3_label"),
      c3_signal:
        scalarFromSection(letterSection, "c3_signal") ??
        scalarFromSection(letterSection, "student_accessible_signal") ??
        scalarFromSection(letterSection, "student_signal"),
      is_correct:
        isCorrect !== null
          ? isCorrect.toLowerCase() === "true"
          : credited !== null
            ? credited.toLowerCase() === "true"
            : undefined,
    };
  }

  return values;
}

function nullableScalar(value: string | null): string | null {
  if (value === null) return null;
  return value === "null" ? null : value;
}

function nestedRecord(value: unknown, key: string): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const child = (value as JsonRecord)[key];
  return child && typeof child === "object" && !Array.isArray(child)
    ? (child as JsonRecord)
    : null;
}

function stringValue(record: JsonRecord | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(record: JsonRecord | null, key: string): number | null {
  const value = record?.[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArrayValue(record: JsonRecord | null, key: string): string[] {
  const value = record?.[key];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return normalizeText(item);
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const rec = item as JsonRecord;
        return stringValue(rec, "label") ?? stringValue(rec, "value") ?? "";
      }
      return "";
    })
    .filter((item) => item.length > 0 && item.toLowerCase() !== "null");
}

function uniqueTexts(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeText(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function c3Record(jsons: JsonRecord[]): JsonRecord | null {
  for (const record of jsons) {
    const direct = nestedRecord(record, "c3");
    if (direct) return direct;
    const nested = nestedRecord(record, "question_yaml_v2");
    const nestedC3 = nestedRecord(nested, "c3");
    if (nestedC3) return nestedC3;
  }
  return null;
}

function parseInlineYamlStringArray(value: string | null): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];
  try {
    const parsed = JSON.parse(trimmed.replace(/'/g, '"'));
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [...trimmed.matchAll(/"([^"]+)"|'([^']+)'/g)]
      .map((match) => match[1] ?? match[2] ?? "")
      .filter(Boolean);
  }
}

function extractRedZoneDimensions(yaml: string, jsons: JsonRecord[]): string[] {
  const values: string[] = [];
  for (const record of jsons) {
    values.push(...stringArrayValue(record, "red_zone_dimensions"));
    values.push(...stringArrayValue(nestedRecord(record, "program_elements"), "red_zone_dimensions"));
    values.push(...stringArrayValue(nestedRecord(record, "analytics_hooks"), "red_zone_dimensions"));
    const nested = nestedRecord(record, "question_yaml_v2");
    values.push(...stringArrayValue(nestedRecord(nested, "program_elements"), "red_zone_dimensions"));
    values.push(...stringArrayValue(nestedRecord(nested, "analytics_hooks"), "red_zone_dimensions"));
  }
  values.push(
    ...parseInlineYamlStringArray(
      scalarFromSection(normalizedSection(yaml, "analytics_hooks"), "red_zone_dimensions"),
    ),
  );
  return uniqueTexts(values);
}

function c3DistractorMolds(jsons: JsonRecord[]): Partial<Record<Letter, string>> {
  const c3 = c3Record(jsons);
  const distractors = c3?.distractors;
  if (!Array.isArray(distractors)) return {};
  const molds: Partial<Record<Letter, string>> = {};
  for (const raw of distractors) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as JsonRecord;
    const choice = stringValue(record, "choice");
    if (!choice || !isLetter(choice)) continue;
    const mold = stringValue(record, "mold") ?? stringValue(record, "mold_code");
    if (mold) molds[choice] = mold;
  }
  return molds;
}

function wrongAnswerRecovery(jsons: JsonRecord[]): Partial<Record<Letter, string>> {
  for (const record of jsons) {
    const intelligence = nestedRecord(record, "program_intelligence");
    const recovery = nestedRecord(intelligence, "wrong_answer_recovery");
    if (!recovery) continue;
    const result: Partial<Record<Letter, string>> = {};
    for (const letter of LETTERS) {
      const raw = recovery[letter];
      if (typeof raw === "string") {
        result[letter] = raw;
      } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const rec = raw as JsonRecord;
        const recoveryText =
          stringValue(rec, "micro_lesson") ??
          stringValue(rec, "diagnosis") ??
          stringValue(rec, "fix");
        if (recoveryText) result[letter] = recoveryText;
      }
    }
    return result;
  }
  return {};
}

function extractChoices(yaml: string, markdown: string): Partial<Record<Letter, string>> {
  for (const key of ["answer_choices", "final_answer_choices", "final_choices", "final_version", "choices"]) {
    const values = parseLetterMap(normalizedSection(yaml, key));
    if (LETTERS.every((letter) => values[letter])) return values;
  }

  const answerArrayValues = parseLetterMap(normalizedSection(yaml, "answer_array"));
  if (LETTERS.every((letter) => answerArrayValues[letter])) return answerArrayValues;

  const markdownChoices = extractMarkdownChoices(markdown);
  if (LETTERS.every((letter) => markdownChoices[letter])) return markdownChoices;

  return {};
}

function extractMarkdownChoices(markdown: string): Partial<Record<Letter, string>> {
  const section = markdown.match(
    /(?:\*\*Final answer choices\*\*|###\s+Final answer choices|##\s+Final answer choices)([\s\S]*?)(?:\*\*Correct answer|###\s+Correct answer|##\s+Correct answer|##\s+Full right-answer explanation)/i,
  )?.[1];
  if (!section) return {};
  const values: Partial<Record<Letter, string>> = {};
  for (const match of section.matchAll(/^\s*([A-D])\.\s+(.+)$/gm)) {
    const letter = match[1] ?? "";
    if (isLetter(letter)) values[letter] = normalizeText(match[2] ?? "");
  }
  return values;
}

function extractStem(yaml: string, markdown: string): string {
  const finalQuestionSection = normalizedSection(yaml, "final_question");
  const yamlStem = firstUsableStem([
    scalarFromSection(finalQuestionSection, "revised_stem"),
    scalarFromSection(finalQuestionSection, "stem"),
    scalarAnywhere(yaml, "revised_stem"),
    scalarAnywhere(yaml, "final_question_stem"),
    scalarAnywhere(yaml, "final_stem"),
    scalarAnywhere(yaml, "stem_summary"),
    scalarAnywhere(yaml, "original_question_summary"),
    stemFromTriggerFacts(yaml),
    scalarAnywhere(yaml, "final_question"),
  ]);
  if (yamlStem) return yamlStem;

  const markdownStem = markdown.match(
    /(?:\*\*Revised question stem\*\*|###\s+Revised question stem)([\s\S]*?)(?:\*\*Final answer choices\*\*|###\s+Final answer choices|##\s+Full right-answer explanation)/i,
  )?.[1];
  if (markdownStem) return normalizeText(stripMarkdown(markdownStem));

  throw new Error("missing final diagnostic question stem");
}

function firstUsableStem(values: Array<string | null>): string | null {
  return values.find(
    (value): value is string => {
      if (!value) return false;
      const trimmed = value.trim();
      return (
        trimmed.length > 20 && !/^use\s+.+\s+above\.?$/i.test(trimmed)
      );
    },
  ) ?? null;
}

function stemFromTriggerFacts(yaml: string): string | null {
  const section = normalizedSection(yaml, "trigger_facts");
  if (!section) return null;
  const facts = [...section.matchAll(/fact:\s*"?([^"\n]+)"?/g)]
    .map((match) => normalizeText(match[1] ?? ""))
    .filter((value) => value.length > 0);
  if (facts.length === 0) return null;
  const call =
    scalarAnywhere(yaml, "revised_call") ??
    scalarAnywhere(yaml, "original_call") ??
    scalarAnywhere(yaml, "call");
  return normalizeText([...facts, call].filter((value): value is string => Boolean(value)).join(" "));
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .trim();
}

function extractCorrectAnswer(yaml: string, markdown: string, jsons: JsonRecord[]): Letter {
  const candidates = [
    scalarAnywhere(yaml, "correct_answer"),
    scalarAnywhere(yaml, "credited_answer"),
    scalarAnywhere(yaml, "official_key"),
    stringValue(jsons[0] ?? null, "credited_answer"),
    markdown.match(/Correct answer[:\s]*\**\s*([A-D])\b/i)?.[1] ?? null,
  ];
  for (const raw of candidates) {
    const letter = raw?.trim().charAt(0) ?? "";
    if (isLetter(letter)) return letter;
  }
  throw new Error("missing correct answer");
}

function extractCall(yaml: string, stem: string): string {
  const explicit =
    scalarAnywhere(yaml, "call_of_question") ??
    scalarAnywhere(yaml, "call") ??
    null;
  if (explicit) return stripTrailingPeriod(explicit);

  const normalized = normalizeText(stem);
  const question = normalized.match(/([^.!?\n][^?]*\?)\s*$/)?.[1];
  if (question) return stripTrailingPeriod(question);
  const colon = normalized.match(/([^.!?\n][^.!?\n]*:)\s*$/)?.[1];
  if (colon) return colon.trim();
  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const last = sentences.at(-1)?.trim();
  return last && last.length > 0 ? stripTrailingPeriod(last) : "Answer the call of the question";
}

function stripTrailingPeriod(value: string): string {
  return value.trim().replace(/\.$/, "");
}

function buildFactPattern(stem: string, call: string): string {
  const normalizedStem = normalizeText(stem);
  const withoutCall = normalizedStem.replace(call, "").replace(/\s+$/, "").trim();
  const cleaned = withoutCall.replace(/[?:]\s*$/, "").trim();
  return cleaned.length > 40 ? cleaned : normalizedStem;
}

function normalizeSubject(value: string | null): string {
  const raw = value?.trim() ?? "";
  if (raw === "CRIMINAL") return "CRIMINAL_LAW";
  if (raw.toLowerCase() === "criminal law") return "CRIMINAL_LAW";
  return raw;
}

function extractAnchorCard(yaml: string, jsons: JsonRecord[]): AmbassadorAnchorCard | null {
  for (const record of jsons) {
    const elements = nestedRecord(record, "program_elements");
    const nested = nestedRecord(record, "question_yaml_v2");
    const nestedElements = nestedRecord(nested, "program_elements");
    const card =
      nestedRecord(record, "remediation_card") ??
      nestedRecord(elements, "remediation_card") ??
      nestedRecord(nestedElements, "remediation_card");
    const id = stringValue(card, "id") ?? stringValue(card, "card_id");
    if (id) {
      return {
        id,
        title: stringValue(card, "title") ?? stringValue(card, "card_title"),
        front:
          stringValue(card, "front") ??
          stringValue(card, "student_rule") ??
          stringValue(card, "student_move") ??
          stringValue(card, "signal"),
        back:
          stringValue(card, "back") ??
          stringValue(card, "rule") ??
          stringValue(card, "tiny_rule"),
      };
    }
  }

  const remediation = normalizedSection(yaml, "remediation");
  if (!remediation) return null;
  for (const key of ["primary_card", "tiny_anchor_card", "recommended_card", "remediation_card"]) {
    const section = normalizedSection(remediation, key);
    const id = scalarFromSection(section, "id") ?? scalarFromSection(section, "card_id");
    if (id) {
      return {
        id,
        title:
          scalarFromSection(section, "title") ??
          scalarFromSection(section, "card_title"),
        front:
          scalarFromSection(section, "front") ??
          scalarFromSection(section, "prompt") ??
          scalarFromSection(section, "tiny_anchor"),
        back:
          scalarFromSection(section, "back") ??
          scalarFromSection(section, "rule") ??
          scalarFromSection(section, "card_text"),
      };
    }
  }
  return null;
}

function parseQuestionSource(markdown: string, sourceFile: string, index: number): AmbassadorDiagnosticQuestion {
  const yaml = yamlFence(markdown);
  const jsons = jsonFences(markdown);
  const barmatrix = normalizedSection(yaml, "barmatrix_row");
  const c3Routing = normalizedSection(yaml, "c3_routing");
  const c3 = c3Record(jsons);
  const sourceQuestionId =
    scalarAnywhere(yaml, "question_id") ??
    scalarAnywhere(yaml, "item_id") ??
    scalarAnywhere(yaml, "qid") ??
    scalarAnywhere(yaml, "source_qid");
  const stem = extractStem(yaml, markdown);
  const call = extractCall(yaml, stem);
  const choicesByLetter = extractChoices(yaml, markdown);
  const correctAnswer = extractCorrectAnswer(yaml, markdown, jsons);
  const answerArrayMeta = parseLetterMetadata(normalizedSection(yaml, "answer_array"));
  const walkthroughMeta = parseLetterMetadata(normalizedSection(yaml, "choice_walkthroughs"));
  const auditMeta = parseLetterMetadata(normalizedSection(yaml, "answer_array_audit"));
  const jsonMolds = c3DistractorMolds(jsons);
  const recovery = wrongAnswerRecovery(jsons);
  const externalId = AMBASSADOR_DIAGNOSTIC_EXTERNAL_IDS[index];
  if (!externalId) throw new Error(`missing external id for ${sourceFile}`);
  const questionId = stableUuid(`ambassador-diagnostic-question:${externalId}`);

  const choices = LETTERS.map((letter): AmbassadorDiagnosticChoice => {
    const text = choicesByLetter[letter];
    if (!text) throw new Error(`${sourceFile} missing choice ${letter}`);
    const meta = mergeMetadata(
      answerArrayMeta[letter],
      auditMeta[letter],
      walkthroughMeta[letter],
    );
    const isCorrect = letter === correctAnswer;
    const mold = isCorrect
      ? null
      : meta.mold_code ?? jsonMolds[letter] ?? fallbackLetterScalar(markdown, letter, "mold_code");
    if (!isCorrect && !mold) {
      throw new Error(`${sourceFile} missing mold_code for ${letter}`);
    }
    return {
      choice_id: stableUuid(`ambassador-diagnostic-choice:${externalId}:${letter}`),
      letter,
      text,
      is_correct: isCorrect,
      filter_broken:
        isCorrect
          ? null
          : meta.filter_broken ?? fallbackLetterScalar(markdown, letter, "filter_broken"),
      mold_code: mold,
      student_label: meta.student_label ?? null,
      c3_signal: meta.c3_signal ?? null,
      wrong_answer_recovery: recovery[letter] ?? null,
      forensic_tags: mold ? [mold] : [],
    };
  });

  const difficulty =
    Number(scalarAnywhere(yaml, "difficulty")) ||
    numberValue(c3, "difficulty") ||
    2;
  const subject =
    normalizeSubject(
      scalarFromSection(barmatrix, "subject") ??
      scalarAnywhere(yaml, "subject") ??
      stringValue(jsons[0] ?? null, "subject"),
    );
  const subtopic =
    scalarFromSection(barmatrix, "subtopic") ??
    scalarAnywhere(yaml, "subtopic") ??
    "Diagnostic";
  if (!subject) throw new Error(`${sourceFile} missing subject`);

  return {
    question_id: questionId,
    external_id: externalId,
    source_file: sourceFile,
    source_question_id: sourceQuestionId,
    subject,
    topic: scalarFromSection(barmatrix, "topic") ?? scalarAnywhere(yaml, "topic"),
    subtopic,
    tension_point:
      scalarFromSection(c3Routing, "tension_axis") ??
      scalarFromSection(c3Routing, "tension_axis_name") ??
      stringValue(c3, "tension_axis") ??
      stringValue(c3, "tension_axis_name") ??
      stringValue(c3, "tension_axis_id"),
    difficulty,
    status: "diagnostic",
    fact_pattern: buildFactPattern(stem, call),
    question_stem: stem,
    call_of_question: call,
    correct_answer: correctAnswer,
    choices,
    anchor_card: extractAnchorCard(yaml, jsons),
    red_zone_dimensions: extractRedZoneDimensions(yaml, jsons),
  };
}

function fallbackLetterScalar(
  markdown: string,
  letter: Letter,
  key: string,
): string | null {
  const pattern = new RegExp(`\\n\\s*${letter}:\\s*\\n([\\s\\S]{0,1600}?)(?=\\n\\s*[A-D]:\\s*\\n|\\n\\S|$)`, "g");
  for (const match of markdown.matchAll(pattern)) {
    const body = match[1] ?? "";
    const value = body.match(new RegExp(`${key}:\\s*\"?([A-Za-z0-9_-]+)\"?`))?.[1];
    if (value) return value;
  }
  return null;
}

function mergeMetadata(
  ...items: Array<LetterMetadata | undefined>
): LetterMetadata {
  const merged: LetterMetadata = {};
  for (const item of items) {
    if (!item) continue;
    for (const key of Object.keys(item) as Array<keyof LetterMetadata>) {
      const value = item[key];
      if (value !== null && value !== undefined) {
        merged[key] = value as never;
      }
    }
  }
  return merged;
}

export function loadAmbassadorDiagnosticSources(
  sourceDir = DEFAULT_AMBASSADOR_DIAGNOSTIC_SOURCE_DIR,
): AmbassadorDiagnosticQuestion[] {
  if (!existsSync(sourceDir)) {
    throw new Error(`diagnostic source directory not found: ${sourceDir}`);
  }
  const names = new Set(readdirSync(sourceDir));
  const selectedFilesAvailable = AMBASSADOR_DIAGNOSTIC_SOURCE_FILES.every((name) =>
    names.has(name),
  );
  const files = selectedFilesAvailable
    ? [...AMBASSADOR_DIAGNOSTIC_SOURCE_FILES]
    : [...names].filter((name) => /^Q1111\d+\.md$/.test(name)).sort();
  if (files.length !== AMBASSADOR_DIAGNOSTIC_EXTERNAL_IDS.length) {
    throw new Error(`expected 20 diagnostic source files, found ${files.length}`);
  }
  return files.map((sourceFile, index) => {
    try {
      return parseQuestionSource(
        readFileSync(path.join(sourceDir, sourceFile), "utf8"),
        sourceFile,
        index,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`${sourceFile}: ${message}`);
    }
  });
}

export function buildFixedDiagnosticQuestionSelection(): FixedDiagnosticQuestionSelection {
  const ids = AMBASSADOR_DIAGNOSTIC_EXTERNAL_IDS;
  const filter = ids.map((_, index) => `$${index + 1}`).join(", ");
  const order = ids.map((_, index) => `$${ids.length + index + 1}`).join(", ");
  return {
    sql: `SELECT q.question_id, q.external_id
       FROM questions q
      WHERE q.status = 'diagnostic'
        AND q.external_id IN (${filter})
      ORDER BY FIELD(q.external_id, ${order})`,
    values: [...ids, ...ids],
  };
}

export function toDiagnosticAttemptRow(
  question: AmbassadorDiagnosticQuestion,
  selectedLetter: Letter,
  confidence: number,
): DiagnosticAttemptRow {
  const selected = question.choices.find((choice) => choice.letter === selectedLetter);
  if (!selected) throw new Error(`${question.external_id} has no choice ${selectedLetter}`);
  return {
    correct: selected.is_correct,
    confidence,
    time_seconds: 30,
    subject: question.subject,
    subtopic: question.subtopic,
    tension_point: question.tension_point,
    selected_forensic_tags: selected.forensic_tags,
  };
}

export function shapeDiagnosticRecommendation(results: DiagnosticResults): DiagnosticRecommendation {
  const level = levelForScore(results.summary.correct * 3, results.summary.total);
  const topLeak = results.top_trap_patterns[0] ?? null;
  const leak = topLeak?.label ?? "your first red zone";
  return {
    level,
    top_leak: topLeak,
    next_step: {
      primary_label: "Start The Method",
      href: "/foundations/lesson-01",
      copy: `Your top leak is ${leak}. Start with The Method, Lesson 1.`,
    },
  };
}

export function buildAmbassadorDiagnosticMysqlMigration(
  questions: AmbassadorDiagnosticQuestion[],
): string {
  const questionRows = questions.map((question) =>
    [
      sqlString(question.question_id),
      sqlString(question.external_id),
      sqlString(question.subject),
      sqlString(question.topic),
      sqlString(question.subtopic),
      sqlString(question.tension_point),
      sqlString(question.fact_pattern),
      sqlString(question.question_stem),
      sqlString(question.call_of_question),
      String(question.difficulty),
      "'diagnostic'",
      "'original'",
      "1",
      sqlJson({
        diagnostic_sequence: Number(question.external_id.slice(-3)),
        source_file: question.source_file,
        source_question_id: question.source_question_id,
        anchor_card: question.anchor_card,
        red_zone_dimensions: question.red_zone_dimensions,
      }),
    ].join(", "),
  );

  const choiceRows = questions.flatMap((question) =>
    question.choices.map((choice) =>
      [
        sqlString(choice.choice_id),
        `(SELECT question_id FROM questions WHERE external_id = ${sqlString(question.external_id)})`,
        sqlString(choice.letter),
        sqlString(choice.text),
        choice.is_correct ? "1" : "0",
        sqlJson(choice.forensic_tags),
        "'[]'",
        sqlString(choice.student_label),
        sqlString(choice.c3_signal),
        sqlString(choice.wrong_answer_recovery),
        sqlString(question.anchor_card?.id ?? null),
      ].join(", "),
    ),
  );

  const choiceComments = questions.flatMap((question) =>
    question.choices.map((choice) => `-- choice ${question.external_id} ${choice.letter}`),
  );

  const tagRows = questions.flatMap((question) => {
    const rows: string[] = [];
    const push = (dimension: string, value: string, metadata: JsonRecord = {}) => {
      rows.push(
        [
          `(SELECT question_id FROM questions WHERE external_id = ${sqlString(question.external_id)})`,
          sqlString(dimension),
          sqlString(value.slice(0, 255)),
          sqlJson(metadata),
        ].join(", "),
      );
    };
    if (question.tension_point) {
      push("tension", slugify(question.tension_point), { label: question.tension_point });
    }
    for (const value of question.red_zone_dimensions) {
      push("red_zone_dimension", slugify(value), {
        label: value,
        source_file: question.source_file,
      });
    }
    for (const choice of question.choices) {
      if (!choice.mold_code) continue;
      push("trap_family", choice.mold_code, {
        source_file: question.source_file,
        choice: choice.letter,
      });
    }
    return rows;
  });

  return [
    "-- Ambassador Day-1 diagnostic migration.",
    "-- Generated from C:/FOC/Workspace/Finished Christian-flavored diagnostic files. JSON columns use MariaDB JSON text.",
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
    ...choiceComments,
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
    "DELETE qt FROM question_tags qt",
    "  JOIN questions q ON q.question_id = qt.question_id",
    ` WHERE q.external_id IN (${questions.map((q) => sqlString(q.external_id)).join(", ")})`,
    "   AND qt.dimension IN ('tension', 'red_zone_dimension', 'trap_family');",
    "",
    ...(tagRows.length > 0
      ? [
          "INSERT INTO question_tags",
          "  (question_id, dimension, value, metadata)",
          "VALUES",
          tagRows.map((row) => `  (${row})`).join(",\n"),
          "ON DUPLICATE KEY UPDATE",
          "  metadata = VALUES(metadata);",
          "",
        ]
      : []),
    "COMMIT;",
    "",
  ].join("\n");
}

function slugify(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 255);
}

function stableUuid(seed: string): string {
  const chars = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  const variant = (Number.parseInt(chars[16] ?? "0", 16) & 0x3) | 0x8;
  chars[16] = variant.toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sqlJson(value: unknown): string {
  return sqlString(JSON.stringify(value));
}

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}
