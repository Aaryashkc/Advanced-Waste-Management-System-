import assert from "node:assert/strict";
import test from "node:test";
import { organizationAccessSchema } from "../validation.schema.js";

test("organization domain documents admin org scoping", () => {
  assert.equal(organizationAccessSchema.adminScopedBy, "orgId");
  assert.equal(organizationAccessSchema.superAdminGlobal, true);
});
