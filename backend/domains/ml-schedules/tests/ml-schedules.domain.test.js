import assert from "node:assert/strict";
import test from "node:test";
import * as domainController from "../controller.js";
import domainRoute from "../route.js";
import { mlScheduleActionSchema } from "../validation.schema.js";
import * as legacyController from "../../../controllers/mlSchedule.controller.js";
import legacyRoute from "../../../routes/mlSchedule.route.js";

test("ml schedule domain exposes allowed scheduler actions", () => {
  assert.deepEqual(mlScheduleActionSchema.allowedActions, ["dispatch", "skip", "reduced"]);
});

test("legacy ml schedule adapters resolve to the domain implementation", () => {
  assert.equal(legacyRoute, domainRoute);
  assert.equal(legacyController.generateSchedule, domainController.generateSchedule);
  assert.equal(legacyController.autoGenerateMLSchedule, domainController.autoGenerateMLSchedule);
});
