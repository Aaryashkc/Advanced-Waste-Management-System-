import assert from "node:assert/strict";
import test from "node:test";
import { billingPaymentSchema } from "../validation.schema.js";

test("billing domain keeps customer bill payment methods explicit", () => {
  assert.deepEqual(billingPaymentSchema.allowedMethods, ["cash"]);
});
