// Prior audit finding: no modal/dialog in the app declared role="dialog" or
// aria-modal, no Escape-to-close existed in any dashboard modal, close
// buttons were unlabeled bare "×" glyphs, and form labels in several
// customer-facing forms were visual siblings of their inputs with no
// htmlFor/id association (so screen readers never announce them on focus).
//
// Phase 2 replaced the Phase-1 hand-rolled per-modal fix with canonical
// shared primitives (Dialog, FormField) so every future modal gets these
// properties for free instead of re-implementing them. This suite checks
// the primitives themselves plus the two modals migrated to use them:
// Add Customer and Create Follow-up.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let dialogSource;
let formFieldSource;

test.before(async () => {
  dialogSource = await readFile("app/components/ui/Dialog.tsx", "utf8");
  formFieldSource = await readFile("app/components/ui/FormField.tsx", "utf8");
});

test("the canonical Dialog primitive declares full accessible-dialog semantics", () => {
  assert.match(dialogSource, /role="dialog"/);
  assert.match(dialogSource, /aria-modal="true"/);
  assert.match(dialogSource, /aria-labelledby=\{titleId\}/);
  assert.match(dialogSource, /aria-label="Close"/);
  assert.match(dialogSource, /useEscapeToClose\(onClose\)/);
});

test("Dialog manages focus: moves focus in on open, traps Tab within itself, and returns focus on close", () => {
  assert.match(dialogSource, /previouslyFocused\.current\s*=\s*document\.activeElement/);
  assert.match(dialogSource, /previouslyFocused\.current\?\.focus\?\.\(\)/);
  assert.match(dialogSource, /event\.key !== "Tab"/);
});

test("the canonical FormField primitive associates label and input via htmlFor + a generated id (not a hardcoded string)", () => {
  assert.match(formFieldSource, /useId\(\)/);
  assert.match(formFieldSource, /htmlFor=\{inputId\}/);
  assert.match(formFieldSource, /id:\s*inputId/);
  assert.match(formFieldSource, /aria-invalid/);
  assert.match(formFieldSource, /aria-describedby/);
});

const MIGRATED_MODALS = [
  ["app/dashboard/customers/page.tsx", "AddCustomerModal"],
  ["app/dashboard/follow-ups/page.tsx", "CreateFollowUpModal"],
];

for (const [file, componentName] of MIGRATED_MODALS) {
  test(`${componentName} (${file}) uses the canonical Dialog + FormField primitives rather than a hand-rolled modal`, async () => {
    const source = await readFile(file, "utf8");
    assert.match(source, /import Dialog from ".*\/ui\/Dialog"/);
    assert.match(source, /import FormField from ".*\/ui\/FormField"/);
    assert.match(source, /<Dialog title=/);
    // no more hand-rolled dialog semantics duplicated at the call site —
    // that responsibility now lives solely in the Dialog primitive
    assert.doesNotMatch(source, /role="dialog"/);
    assert.doesNotMatch(source, /aria-modal="true"/);
  });
}
