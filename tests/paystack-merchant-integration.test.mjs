import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const client = fs.readFileSync(
  "lib/integrations/paystack-merchant/client.ts",
  "utf8",
);
const connect = fs.readFileSync(
  "app/api/integrations/paystack-merchant/connect/route.ts",
  "utf8",
);
const status = fs.readFileSync(
  "app/api/integrations/paystack-merchant/status/route.ts",
  "utf8",
);
const disconnect = fs.readFileSync(
  "app/api/integrations/paystack-merchant/disconnect/route.ts",
  "utf8",
);
const testRoute = fs.readFileSync(
  "app/api/integrations/paystack-merchant/test/route.ts",
  "utf8",
);
const connectRouter = fs.readFileSync(
  "app/api/integrations/connect/route.ts",
  "utf8",
);

test("Paystack merchant integration uses tenant-owned secret key", () => {
  assert.match(connect, /secretKey/);
  assert.doesNotMatch(
    connect + client,
    /process\.env\.PAYSTACK_SECRET_KEY/,
  );
});

test("Paystack merchant credentials are encrypted", () => {
  assert.match(client, /encrypt\(/);
  assert.match(client, /decrypt\(/);
  assert.match(connect, /credentialsEncrypted/);
});

test("Paystack verifies real API access before activation", () => {
  assert.match(client, /api\.paystack\.co/);
  assert.match(client, /\/transaction\?perPage=1&page=1/);
  assert.match(connect, /verifyPaystackTransactionAccess/);
});

test("Paystack routes use canonical workspace resolution", () => {
  for (const source of [connect, status, disconnect, testRoute]) {
    assert.match(source, /getCurrentMembership/);
    assert.match(source, /membership\.businessId/);
  }
});

test("Paystack status never exposes encrypted credentials", () => {
  const responseArea = status.slice(status.indexOf("return NextResponse"));
  assert.doesNotMatch(responseArea, /credentialsEncrypted/);
  assert.doesNotMatch(responseArea, /secretKey/);
});

test("Paystack test route verifies stored merchant access", () => {
  assert.match(testRoute, /decryptPaystackSecret/);
  assert.match(testRoute, /verifyPaystackTransactionAccess/);
});

test("Paystack merchant remains separate from platform billing secret", () => {
  assert.doesNotMatch(
    connect + status + disconnect + testRoute + client,
    /PAYSTACK_PLAN_|PAYSTACK_AMOUNT_|SUPERKUBA_BILLING_CURRENCY/,
  );
});

test("Paystack Connect opens real merchant setup page", () => {
  assert.match(connectRouter, /provider\.id === "paystack_merchant"/);
  assert.match(
    connectRouter,
    /\/dashboard\/integrations\/paystack-merchant/,
  );
});
