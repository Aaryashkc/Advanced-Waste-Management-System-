const EXACT_TRUCK_LIMIT = 16;
const BEAM_WIDTH = 250;

function getTruckId(truck) {
  return String(truck.id || truck._id || truck.truckId);
}

function getTruckCapacity(truck) {
  return Number(truck.capacity_kg ?? truck.capacity ?? 0) || 0;
}

function distanceKm(a, b) {
  if (!a?.latitude || !a?.longitude || !b?.latitude || !b?.longitude) return 0;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function scoreSubset(area, subset, options = {}) {
  const predictedWasteKg = Number(area.predictedWasteKg ?? area.predicted_waste_kg ?? 0) || 0;
  const areaOrgId = area.orgId || area.org_id || null;
  const areaLocation = area.location || area.coordinates || null;
  const capacity = subset.reduce((sum, truck) => sum + getTruckCapacity(truck), 0);
  const uncovered = Math.max(0, predictedWasteKg - capacity);
  const excess = Math.max(0, capacity - predictedWasteKg);
  const crossOrgCount = subset.filter((truck) => areaOrgId && truck.org_id !== areaOrgId).length;
  const driverlessCount = subset.filter((truck) => !truck.driver_id && !truck.driverId).length;
  const distancePenalty = subset.reduce((sum, truck) => {
    const truckLocation = truck.location || truck.currentLocation || truck.driver_location || null;
    return sum + distanceKm(areaLocation, truckLocation);
  }, 0);

  return {
    capacity,
    uncovered,
    excess,
    cost:
      uncovered * (options.uncoveredWeight || 1000000)
      + excess * (options.excessWeight || 1000)
      + crossOrgCount * (options.crossOrgPenalty || 10000)
      + driverlessCount * (options.driverlessPenalty || 50000)
      + distancePenalty * (options.distanceWeight || 25)
      + subset.length * (options.truckCountPenalty || 5),
  };
}

function buildSubsetOptions(area, trucks, options = {}) {
  const allowCrossOrg = options.allowCrossOrg !== false;
  const areaOrgId = area.orgId || area.org_id || null;
  let candidates = trucks.filter((truck) => {
    if (!Number.isFinite(getTruckCapacity(truck)) || getTruckCapacity(truck) <= 0) return false;
    if (!allowCrossOrg && areaOrgId && truck.org_id && truck.org_id !== areaOrgId) return false;
    return true;
  });

  candidates = candidates
    .map((truck) => ({
      truck,
      preferenceCost: scoreSubset(area, [truck], options).cost,
    }))
    .sort((a, b) => a.preferenceCost - b.preferenceCost)
    .slice(0, options.maxCandidatesPerArea || EXACT_TRUCK_LIMIT)
    .map((entry) => entry.truck);

  const subsetOptions = [{ mask: 0n, trucks: [], ...scoreSubset(area, [], options) }];
  const totalMasks = 1 << candidates.length;
  for (let mask = 1; mask < totalMasks; mask += 1) {
    const subset = [];
    for (let idx = 0; idx < candidates.length; idx += 1) {
      if (mask & (1 << idx)) subset.push(candidates[idx]);
    }
    const stats = scoreSubset(area, subset, options);
    let globalMask = 0n;
    for (const truck of subset) globalMask |= options.truckBitById.get(getTruckId(truck));
    subsetOptions.push({ mask: globalMask, trucks: subset, ...stats });
  }

  return subsetOptions
    .sort((a, b) => a.cost - b.cost)
    .slice(0, options.maxOptionsPerArea || 350);
}

/**
 * Optimizes truck-to-area assignment after ML prediction.
 *
 * Objective, in priority order through weighted cost:
 * - minimize uncovered predicted waste
 * - minimize excess assigned capacity
 * - prefer same-organization trucks
 * - prefer nearby trucks/drivers when coordinates are available
 * - penalize driverless trucks
 */
export function optimizeTruckAssignments(areas, trucks, options = {}) {
  const serviceAreas = areas.filter((area) => {
    const wasteCategory = area.wasteCategory ?? area.waste_category;
    const predictedWasteKg = Number(area.predictedWasteKg ?? area.predicted_waste_kg ?? 0) || 0;
    return wasteCategory !== "none" && predictedWasteKg > 0;
  });

  const truckList = trucks.filter((truck) => getTruckCapacity(truck) > 0);
  const truckBitById = new Map(truckList.map((truck, idx) => [getTruckId(truck), 1n << BigInt(idx)]));
  const optimizerOptions = { ...options, truckBitById };

  const orderedAreas = [...serviceAreas].sort(
    (a, b) => (Number(b.predictedWasteKg ?? b.predicted_waste_kg ?? 0) || 0)
      - (Number(a.predictedWasteKg ?? a.predicted_waste_kg ?? 0) || 0)
  );

  const states = new Map([[0n, { cost: 0, assignment: new Map() }]]);

  for (const area of orderedAreas) {
    const areaKey = area.area || area.district || area.name;
    const subsetOptions = buildSubsetOptions(area, truckList, optimizerOptions);
    const nextStates = new Map();

    for (const [usedMask, state] of states) {
      for (const subset of subsetOptions) {
        if ((usedMask & subset.mask) !== 0n) continue;
        const nextMask = usedMask | subset.mask;
        const nextCost = state.cost + subset.cost;
        const existing = nextStates.get(nextMask);
        if (!existing || nextCost < existing.cost) {
          const assignment = new Map(state.assignment);
          assignment.set(areaKey, subset);
          nextStates.set(nextMask, { cost: nextCost, assignment });
        }
      }
    }

    const sorted = [...nextStates.entries()].sort((a, b) => a[1].cost - b[1].cost);
    const kept = truckList.length <= EXACT_TRUCK_LIMIT ? sorted : sorted.slice(0, options.beamWidth || BEAM_WIDTH);
    states.clear();
    for (const [mask, state] of kept) states.set(mask, state);
  }

  const best = [...states.values()].sort((a, b) => a.cost - b.cost)[0] || { assignment: new Map(), cost: 0 };
  const assignmentByArea = new Map();
  for (const area of areas) {
    const areaKey = area.area || area.district || area.name;
    assignmentByArea.set(areaKey, best.assignment.get(areaKey) || {
      trucks: [],
      capacity: 0,
      uncovered: Number(area.predictedWasteKg ?? area.predicted_waste_kg ?? 0) || 0,
      excess: 0,
      cost: 0,
    });
  }

  return {
    assignmentByArea,
    totalCost: best.cost,
    method: truckList.length <= EXACT_TRUCK_LIMIT ? "exact-bitmask-dp" : "beam-search-dp",
  };
}

/**
 * Backward-compatible single-area knapsack helper used by older callers.
 */
export const knapsackOptimization = (trucks, estimatedWasteVolume, wasteType) => {
  const compatibleTrucks = trucks.filter((truck) => {
    const typeMatches = !wasteType || truck.truckType === wasteType || truck.truckType === "MIXED";
    return typeMatches && truck.isAvailable !== false;
  });

  if (compatibleTrucks.length === 0) {
    return {
      success: false,
      message: "No compatible trucks available",
      selectedTrucks: [],
    };
  }

  const area = { area: "__single__", predictedWasteKg: estimatedWasteVolume };
  const { assignmentByArea, method } = optimizeTruckAssignments([area], compatibleTrucks, {
    allowCrossOrg: true,
  });
  const selected = assignmentByArea.get("__single__");

  return {
    success: selected.uncovered <= 0,
    method,
    selectedTrucks: selected.trucks.map((truck) => ({
      truckId: truck._id || truck.id,
      allocatedVolume: Math.min(getTruckCapacity(truck), estimatedWasteVolume),
    })),
    totalCapacity: selected.capacity,
    remainingVolume: Math.max(0, selected.uncovered),
    excessCapacity: selected.excess,
  };
};
