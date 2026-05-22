import assert from "node:assert/strict";
import test from "node:test";
import { knapsackOptimization, optimizeTruckAssignments } from "../utils/utils.js";

test("knapsackOptimization minimizes excess capacity for a single waste estimate", () => {
  const result = knapsackOptimization([
    { _id: "large", truckType: "MIXED", isAvailable: true, capacity: 10000 },
    { _id: "fit-a", truckType: "MIXED", isAvailable: true, capacity: 3000 },
    { _id: "fit-b", truckType: "MIXED", isAvailable: true, capacity: 3000 },
  ], 6000, "BIO");

  assert.equal(result.success, true);
  assert.equal(result.totalCapacity, 6000);
  assert.deepEqual(result.selectedTrucks.map((truck) => truck.truckId).sort(), ["fit-a", "fit-b"]);
});

test("optimizeTruckAssignments prefers same-organization trucks when coverage is equal", () => {
  const { assignmentByArea } = optimizeTruckAssignments([
    { area: "Baneshwor", predictedWasteKg: 4000, wasteCategory: "high", orgId: "org-a" },
  ], [
    { id: "same-org", capacity_kg: 4000, org_id: "org-a", driver_id: "driver-a" },
    { id: "other-org", capacity_kg: 4000, org_id: "org-b", driver_id: "driver-b" },
  ]);

  const assignment = assignmentByArea.get("Baneshwor");
  assert.equal(assignment.uncovered, 0);
  assert.deepEqual(assignment.trucks.map((truck) => truck.id), ["same-org"]);
});
