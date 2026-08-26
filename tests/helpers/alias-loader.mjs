// Minimal Node ESM loader resolving the repo's "@/*" tsconfig path alias so
// tests can import real, aliased lib/mastra modules under plain `node
// --experimental-strip-types --test`, instead of reimplementing their logic
// locally. Registered via node:module's register() from within a test file;
// does not change the npm test invocation or any production code.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(new URL("../..", import.meta.url).pathname);

function resolveExtensionless(base) {
  const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = resolveExtensionless(path.join(REPO_ROOT, specifier.slice(2)));
    if (!target) throw new Error(`alias-loader: could not resolve "${specifier}" under ${REPO_ROOT}`);
    return nextResolve(pathToFileURL(target).href, context);
  }
  // Bare relative imports without an extension (e.g. "./schema") only resolve
  // automatically under bundlers, not plain Node ESM — needed because
  // production files like db/index.ts import "./schema" without ".ts".
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier)) {
    const parentPath = context.parentURL ? path.dirname(new URL(context.parentURL).pathname) : REPO_ROOT;
    const target = resolveExtensionless(path.join(parentPath, specifier));
    if (target) return nextResolve(pathToFileURL(target).href, context);
  }
  return nextResolve(specifier, context);
}
