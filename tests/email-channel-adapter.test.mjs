import path from "node:path";
import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);

test("Email resolves to the canonical Email adapter, never WhatsApp", () => {
  const registry = fs.readFileSync(path.join(REPO_ROOT, "lib/channels/index.ts"), "utf8");
  assert.match(registry, /import[\s\S]*emailAdapter[\s\S]*from "\.\/email"/);
  assert.match(registry, /email:\s*emailAdapter/);
  assert.doesNotMatch(registry, /email:\s*whatsappAdapter/);
  const adapter = fs.readFileSync(path.join(REPO_ROOT, "lib/channels/email.ts"), "utf8");
  assert.match(adapter, /eq\(integrations\.businessId, payload\.businessId\)/);
  assert.match(adapter, /eq\(integrations\.provider, "email"\)/);
});
