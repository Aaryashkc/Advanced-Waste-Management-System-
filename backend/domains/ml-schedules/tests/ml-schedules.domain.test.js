import assert from "node:assert/strict";
import test from "node:test";
import { mlScheduleActionSchema } from "../validation.schema.js";

test("ml schedule domain exposes allowed scheduler actions", () => {
  assert.deepEqual(mlScheduleActionSchema.allowedActions, ["dispatch", "skip", "reduced"]);
});
