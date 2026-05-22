import assert from "node:assert/strict";
import test from "node:test";
import { registerSchema } from "../validation.schema.js";

test("auth domain registration is customer-only by contract", () => {
  assert.equal(registerSchema.allowedRole, "customer_admin");
  assert.deepEqual(registerSchema.required, ["name", "email", "phone"]);
});
