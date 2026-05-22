import assert from "node:assert/strict";
import test from "node:test";
import { pickupStatusTransitionSchema } from "../validation.schema.js";

test("pickup domain exposes the driver lifecycle targets", () => {
  assert.deepEqual(pickupStatusTransitionSchema.allowedTargets, [
    "EN_ROUTE",
    "ARRIVED",
    "COLLECTING",
    "COMPLETED",
  ]);
});
