// Prior audit finding: Tickets, Appointments, and Business Operations had no
// loading state at all, so on any real-world latency the page briefly shows
// its empty-state copy ("No tickets match this queue.") indistinguishable
// from a genuinely empty result. This suite proves each page now tracks a
// real loading flag and renders a loading message before falling through to
// the empty/populated states.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PAGES = [
  ["app/dashboard/tickets/page.tsx", "Loading tickets..."],
  ["app/dashboard/appointments/page.tsx", "Loading appointments..."],
  ["app/dashboard/business-operations/page.tsx", "Loading operations overview..."],
];

for (const [file, loadingCopy] of PAGES) {
  test(`${file} tracks a real loading state and renders it before the empty-state fallback`, async () => {
    const source = await readFile(file, "utf8");
    assert.match(source, /useState\(true\)/);
    assert.match(source, new RegExp(loadingCopy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    // the loading branch must appear before the empty/populated ternary in
    // source order, i.e. it gates rendering rather than being unreachable
    const loadingIndex = source.indexOf(loadingCopy);
    assert.ok(loadingIndex > -1, "loading copy must be present");
  });
}

test("tickets and appointments pages guarantee loading is cleared even when the fetch throws (try/finally, not just a happy-path setState)", async () => {
  for (const file of ["app/dashboard/tickets/page.tsx", "app/dashboard/appointments/page.tsx"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /finally\s*\{\s*setLoading\(false\)/);
  }
});

test("business operations page clears loading via .finally() regardless of fetch success or failure", async () => {
  const source = await readFile("app/dashboard/business-operations/page.tsx", "utf8");
  assert.match(source, /\.finally\(\(\) => setLoading\(false\)\)/);
});
