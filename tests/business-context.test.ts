import assert from "node:assert/strict";
import test from "node:test";
import { selectActiveMembership } from "../lib/auth/business-context";

const memberships = [{ businessId: "business-a" }, { businessId: "business-b" }];
test("requires an explicit business selection when a user has multiple memberships", () => assert.equal(selectActiveMembership(memberships), null));
test("returns only the matching membership", () => assert.deepEqual(selectActiveMembership(memberships, "business-b"), { businessId: "business-b" }));
test("rejects an unauthorized requested business", () => assert.equal(selectActiveMembership(memberships, "business-c"), null));
