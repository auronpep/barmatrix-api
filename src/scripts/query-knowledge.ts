import dotenv from "dotenv";
import {
  buildKnowledgeSearchQuery,
  normalizeKnowledgeSearch,
  shapeKnowledgeSearchResponse,
  type KnowledgeRow,
} from "../lib/knowledge.js";

interface CliArgs {
  envFile: string;
  filters: Record<string, string | number | boolean>;
}

function parseArgs(argv: string[]): CliArgs {
  const filters: Record<string, string | number | boolean> = {};
  let envFile = process.env.BMO_ENV_FILE ?? "C:/Users/JesusLovesMe/.env";

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env") envFile = requireValue(argv, ++index, "--env");
    else if (arg === "--q") filters.q = requireValue(argv, ++index, "--q");
    else if (arg === "--subject") filters.subject = requireValue(argv, ++index, "--subject");
    else if (arg === "--topic") filters.topic = requireValue(argv, ++index, "--topic");
    else if (arg === "--subtopic") filters.subtopic = requireValue(argv, ++index, "--subtopic");
    else if (arg === "--component") filters.component = requireValue(argv, ++index, "--component");
    else if (arg === "--channel") filters.channel = requireValue(argv, ++index, "--channel");
    else if (arg === "--object-type") filters.object_type = requireValue(argv, ++index, "--object-type");
    else if (arg === "--review-status") filters.review_status = requireValue(argv, ++index, "--review-status");
    else if (arg === "--promotion-status") filters.promotion_status = requireValue(argv, ++index, "--promotion-status");
    else if (arg === "--canonicality") filters.canonicality = requireValue(argv, ++index, "--canonicality");
    else if (arg === "--source-id") filters.source_id = requireValue(argv, ++index, "--source-id");
    else if (arg === "--limit") filters.limit = Number(requireValue(argv, ++index, "--limit"));
    else if (arg === "--include-rejected") filters.include_rejected = true;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { envFile, filters };
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) throw new Error(`Missing value for ${flag}`);
  return value;
}

function printHelp(): void {
  console.log(`Usage:
  npm run knowledge:search -- --q decoder --component trap-taxonomy --limit 10

Options:
  --q <text>
  --subject <subject>
  --topic <topic>
  --subtopic <subtopic>
  --component <component-or-alias>
  --channel <channel1|channel2|bridge|product_surface>
  --object-type <type>
  --review-status <status>
  --promotion-status <status>
  --canonicality <status>
  --source-id <SRC-XXXX>
  --limit <1-50>
  --include-rejected
  --env <dotenv-path>`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  dotenv.config({ path: args.envFile });
  process.env.DATABASE_NAME ??= process.env.BARMATRIX_MySQL_Database;
  process.env.DATABASE_USER ??= process.env.BARMATRIX_MySQL_User;
  setNonDbPlaceholders();
  const { getPool } = await import("../db.js");

  const filters = normalizeKnowledgeSearch(args.filters);
  const query = buildKnowledgeSearchQuery(filters);
  const { rows } = await getPool().query<KnowledgeRow>(query.sql, query.values);
  const response = shapeKnowledgeSearchResponse(filters, rows);
  console.log(JSON.stringify(response, null, 2));
}

function setNonDbPlaceholders(): void {
  process.env.STRIPE_SECRET_KEY ??= "sk_cli_placeholder";
  process.env.STRIPE_WEBHOOK_SECRET ??= "whsec_cli_placeholder";
  process.env.STRIPE_PRODUCT_BARMATRIX_FLAGSHIP ??= "prod_cli_placeholder";
  process.env.STRIPE_PRICE_PAY_IN_FULL ??= "price_cli_full";
  process.env.STRIPE_PRICE_FLAGSHIP_ANCHOR ??= "price_cli_anchor";
  process.env.STRIPE_PRICE_PAY_IN_TWO ??= "price_cli_two";
  process.env.STRIPE_PRICE_PAY_IN_TWO_SECOND ??= "price_cli_second";
  process.env.CLERK_PUBLISHABLE_KEY ??= "pk_cli_placeholder";
  process.env.CLERK_SECRET_KEY ??= "sk_cli_placeholder";
  process.env.FRONTEND_URL ??= "https://barmatrix.app";
  process.env.SUCCESS_URL ??= "https://barmatrix.app/account/?welcome=1";
  process.env.CANCEL_URL ??= "https://barmatrix.app/pricing/";
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
