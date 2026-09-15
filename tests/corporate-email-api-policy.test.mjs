import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const source = fs.readFileSync(path.join(ROOT, "app/api/employees/route.ts"), "utf8");

test("employee listing derives corporate identities from the tenant-scoped registry", () => {
  assert.match(source, /getCorporateEmployeeEmail/);
  assert.match(source, /businesses\.slug/);
  assert.match(source, /email:\s*getCorporateEmployeeEmail/);
});
