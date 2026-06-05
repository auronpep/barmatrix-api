import { cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const src = resolve(repoRoot, "src/data");
const dest = resolve(repoRoot, "dist/data");

await rm(dest, { recursive: true, force: true });

if (existsSync(src)) {
  await cp(src, dest, { recursive: true });
}
