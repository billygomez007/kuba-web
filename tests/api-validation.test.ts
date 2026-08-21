import assert from "node:assert/strict";
import test from "node:test";
import { RequestValidationError, requiredString, validId } from "../lib/api/validation";

test("accepts a normalized valid identifier", () => assert.equal(validId(" customer-123 ", "Customer ID"), "customer-123"));
test("rejects malformed identifiers", () => assert.throws(() => validId("customer/id", "Customer ID"), RequestValidationError));
test("rejects empty and oversized strings", () => { assert.throws(() => requiredString("   ", "Name"), RequestValidationError); assert.throws(() => requiredString("a".repeat(11), "Name", 10), RequestValidationError); });
