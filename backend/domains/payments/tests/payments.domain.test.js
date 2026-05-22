import assert from "node:assert/strict";
import test from "node:test";
import { paymentMethodSchema } from "../validation.schema.js";

test("payments domain keeps payment methods allow-listed", () => {
  assert.deepEqual(paymentMethodSchema.allowedMethods, ["cash", "esewa"]);
});
