import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const {
  getCorporateEmployeeEmail,
  getPrimaryInboundEmployeeType,
} = await import("@/lib/email/corporate-identities");

test("SuperKuba corporate employee identities use the approved shared function mailboxes", () => {
  const expected = {
    receptionist: "hello@superkuba.com",
    sales: "sales@superkuba.com",
    outreach: "sales@superkuba.com",
    "customer-support": "support@superkuba.com",
    operations: "onboarding@superkuba.com",
    finance: "billing@superkuba.com",
    accountant: "billing@superkuba.com",
    "general-manager": "partnerships@superkuba.com",
    hr: "people@superkuba.com",
  };
  for (const [employeeType, email] of Object.entries(expected)) {
    assert.equal(getCorporateEmployeeEmail({ businessSlug: "superkuba", employeeType }), email);
  }
});

test("shared sales and billing mailboxes have one explicit inbound owner", () => {
  assert.equal(getPrimaryInboundEmployeeType({ businessSlug: "superkuba", mailbox: "sales@superkuba.com" }), "sales");
  assert.equal(getPrimaryInboundEmployeeType({ businessSlug: "superkuba", mailbox: "billing@superkuba.com" }), "finance");
});

test("corporate identities never become defaults for another tenant", () => {
  assert.equal(getCorporateEmployeeEmail({ businessSlug: "acme", employeeType: "sales" }), null);
  assert.equal(getPrimaryInboundEmployeeType({ businessSlug: "acme", mailbox: "sales@superkuba.com" }), null);
});
