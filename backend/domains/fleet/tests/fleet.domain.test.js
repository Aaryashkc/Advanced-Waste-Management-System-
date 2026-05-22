import assert from "node:assert/strict";
import test from "node:test";
import { fleetRoleSchema } from "../validation.schema.js";

test("fleet domain keeps driver/admin role surface explicit", () => {
  assert.deepEqual(fleetRoleSchema.allowedRoles, ["driver", "admin", "super_admin"]);
});
