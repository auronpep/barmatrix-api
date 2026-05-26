// Small string-formatting helpers used by the forensics endpoint to derive
// human-readable trap names and drill names from snake_case tags and
// kebab-case slugs respectively.

export function snakeToTitle(s: string): string {
  if (!s) return "";
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function kebabToTitle(s: string): string {
  if (!s) return "";
  return s
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
