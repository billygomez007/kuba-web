// Prior audit finding: no modal/dialog in the app declared role="dialog" or
// aria-modal, no Escape-to-close existed in any dashboard modal, close
// buttons were unlabeled bare "×" glyphs, and form labels in several
// customer-facing forms were visual siblings of their inputs with no
// htmlFor/id association (so screen readers never announce them on focus).
// This suite covers the two modals prioritized as active customer-facing
// flows: Add Customer and Create Follow-up.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a shared Escape-to-close hook exists and both fixed modals use it", async () => {
  assert.equal(existsSync("app/components/useEscapeToClose.ts"), true);
  for (const file of ["app/dashboard/customers/page.tsx", "app/dashboard/follow-ups/page.tsx"]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /useEscapeToClose\(onClose\)/);
  }
});

const MODALS = [
  ["app/dashboard/customers/page.tsx", "add-customer-modal-title"],
  ["app/dashboard/follow-ups/page.tsx", "create-follow-up-modal-title"],
];

for (const [file, titleId] of MODALS) {
  test(`${file}'s modal declares dialog semantics and a labeled close button`, async () => {
    const source = await readFile(file, "utf8");
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, new RegExp(`aria-labelledby="${titleId}"`));
    assert.match(source, new RegExp(`id="${titleId}"`));
    assert.match(source, /aria-label="Close"/);
  });
}

test("the Add Customer modal's fields have real label/input association (htmlFor + id), not just visually-adjacent siblings", async () => {
  const source = await readFile("app/dashboard/customers/page.tsx", "utf8");
  assert.match(source, /htmlFor=\{inputId\}/);
  assert.match(source, /id=\{inputId\}/);
});

test("the Create Follow-up modal's four fields each have real label/input association", async () => {
  const source = await readFile("app/dashboard/follow-ups/page.tsx", "utf8");
  for (const id of ["follow-up-lead", "follow-up-title", "follow-up-due-at", "follow-up-description"]) {
    assert.match(source, new RegExp(`htmlFor="${id}"`));
    assert.match(source, new RegExp(`id="${id}"`));
  }
});
