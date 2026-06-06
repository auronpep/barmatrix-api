import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildAmbassadorDiagnosticMysqlMigration,
  loadAmbassadorDiagnosticSources,
} from "../lib/ambassador-diagnostic.js";

const outputPath =
  process.argv[2] ??
  "C:/BMO/BARMATRIX/engineering/SCHEMA_DIAGNOSTIC_MYSQL.sql";

const questions = loadAmbassadorDiagnosticSources();
const sql = buildAmbassadorDiagnosticMysqlMigration(questions);

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, sql, "utf8");

console.log(`wrote ${questions.length} diagnostic questions to ${outputPath}`);
