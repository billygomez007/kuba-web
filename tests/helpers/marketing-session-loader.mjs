// Replace only the HTTP session boundary. Routes, Marketing RBAC, database,
// transactions, audit writes and read models run unchanged against SQLite.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/auth/tenant") {
    return { url: "data:text/javascript," + encodeURIComponent("export async function requireBusinessMembership() { return globalThis.__marketingTestSession; }"), shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
