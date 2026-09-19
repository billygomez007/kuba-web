import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP = path.join(ROOT, "app");
const DASHBOARD = path.join(APP, "dashboard");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function rel(file) {
  return path.relative(ROOT, file);
}

function routeFromPage(file) {
  let route = rel(path.dirname(file))
    .replace(/^app/, "")
    .replace(/\([^/]+\)\//g, "")
    .replace(/\/page$/, "");

  if (!route.startsWith("/")) route = "/" + route;
  return route || "/";
}

function routePatternToRegex(route) {
  const pattern = route
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\[\\\[\\.\\.\\.(.+?)\\\]\\\]/g, "(?:.*)?")
    .replace(/\\\[\\.\\.\\.(.+?)\\\]/g, ".+")
    .replace(/\\\[(.+?)\\\]/g, "[^/]+");

  return new RegExp("^" + pattern + "/?$");
}

const pageFiles = walk(APP).filter((f) => /\/page\.(tsx|ts|jsx|js)$/.test(f));
const componentFiles = walk(DASHBOARD).filter((f) => /\.(tsx|ts|jsx|js)$/.test(f));

const routes = pageFiles.map(routeFromPage);
const routeMatchers = routes.map((route) => ({
  route,
  regex: routePatternToRegex(route),
}));

function routeExists(target) {
  if (!target.startsWith("/")) return true;
  const clean = target.split("?")[0].split("#")[0];
  if (clean.startsWith("/api/")) return true;
  return routeMatchers.some(({ regex }) => regex.test(clean));
}

const links = [];
const pushes = [];
const suspiciousButtons = [];

for (const file of componentFiles) {
  const source = fs.readFileSync(file, "utf8");

  const hrefRegex = /\bhref\s*=\s*["'`]([^"'`]+)["'`]/g;
  for (const match of source.matchAll(hrefRegex)) {
    links.push({
      file: rel(file),
      target: match[1],
      valid: routeExists(match[1]),
    });
  }

  const routerRegex =
    /\b(?:router\.(?:push|replace)|redirect|permanentRedirect)\s*\(\s*["'`]([^"'`]+)["'`]/g;

  for (const match of source.matchAll(routerRegex)) {
    pushes.push({
      file: rel(file),
      target: match[1],
      valid: routeExists(match[1]),
    });
  }

  const buttonRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
  for (const match of source.matchAll(buttonRegex)) {
    const attrs = match[1] || "";
    const body = (match[2] || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);

    const hasAction =
      /\bonClick\s*=/.test(attrs) ||
      /\btype\s*=\s*["']submit["']/.test(attrs) ||
      /\bformAction\s*=/.test(attrs) ||
      /\bdisabled\b/.test(attrs);

    if (!hasAction) {
      const before = source.slice(Math.max(0, match.index - 180), match.index);
      const wrappedByLink = /<Link\b[^>]*>\s*$/.test(before);

      if (!wrappedByLink) {
        suspiciousButtons.push({
          file: rel(file),
          label: body || "(no visible label)",
        });
      }
    }
  }
}

const brokenLinks = links.filter((item) => !item.valid);
const brokenPushes = pushes.filter((item) => !item.valid);

const output = [];
output.push("# SuperKuba Dashboard Navigation Audit");
output.push("");
output.push(`Generated: ${new Date().toISOString()}`);
output.push("");
output.push(`Pages discovered: ${routes.length}`);
output.push(`Static Link href destinations scanned: ${links.length}`);
output.push(`Static router/redirect destinations scanned: ${pushes.length}`);
output.push(`Broken static Link destinations: ${brokenLinks.length}`);
output.push(`Broken static router/redirect destinations: ${brokenPushes.length}`);
output.push(`Buttons requiring manual review: ${suspiciousButtons.length}`);
output.push("");

output.push("## Broken static links");
output.push("");
if (brokenLinks.length === 0) {
  output.push("None found.");
} else {
  for (const item of brokenLinks) {
    output.push(`- \`${item.target}\` — ${item.file}`);
  }
}

output.push("");
output.push("## Broken router / redirect destinations");
output.push("");
if (brokenPushes.length === 0) {
  output.push("None found.");
} else {
  for (const item of brokenPushes) {
    output.push(`- \`${item.target}\` — ${item.file}`);
  }
}

output.push("");
output.push("## Buttons requiring manual review");
output.push("");
if (suspiciousButtons.length === 0) {
  output.push("None found.");
} else {
  for (const item of suspiciousButtons) {
    output.push(`- ${item.file} — "${item.label}"`);
  }
}

output.push("");
output.push("## Dashboard routes");
output.push("");
for (const route of routes.filter((route) => route.startsWith("/dashboard")).sort()) {
  output.push(`- ${route}`);
}

fs.writeFileSync(
  path.join(ROOT, "reports", "SUPERKUBA_NAVIGATION_AUDIT.md"),
  output.join("\n"),
);

console.log("=== NAVIGATION AUDIT SUMMARY ===");
console.log(`Dashboard/page routes: ${routes.length}`);
console.log(`Static links scanned: ${links.length}`);
console.log(`Router destinations scanned: ${pushes.length}`);
console.log(`Broken static links: ${brokenLinks.length}`);
console.log(`Broken router destinations: ${brokenPushes.length}`);
console.log(`Buttons needing review: ${suspiciousButtons.length}`);
console.log("");
console.log("Report: reports/SUPERKUBA_NAVIGATION_AUDIT.md");

if (brokenLinks.length || brokenPushes.length) {
  process.exitCode = 2;
}
