import PickupRequest from "../models/PickupRequest.model.js";
import PickupEvent from "../models/PickupEvent.model.js";
import Driver from "../models/Driver.model.js";
import { getIO } from "../socket/socketServer.js";

/**
 * Remove the old TTL index on PickupRequest.expiresAt. TTL indexes delete
 * documents, but pickup rows must stay available for dashboards, payment
 * callbacks, and history.
 */
export async function ensurePickupRequestIndexes() {
  const collection = PickupRequest.collection;
  const indexes = await collection.indexes();
  let hasLookupIndex = false;

  for (const index of indexes) {
    const isExpiresAtIndex =
      index.key &&
      Object.keys(index.key).length === 1 &&
      index.key.expiresAt === 1;

    if (isExpiresAtIndex && index.expireAfterSeconds != null) {
      await collection.dropIndex(index.name);
      console.log(`[PickupExpiry] Dropped destructive TTL index: ${index.name}`);
    } else if (isExpiresAtIndex) {
      hasLookupIndex = true;
    }
  }

  if (!hasLookupIndex) {
    await collection.createIndex({ expiresAt: 1 }, { name: "expiresAt_1" });
  }
}

function activePickupFilter(driverUserId) {
  return {
    driverId: driverUserId,
    status: { $in: ["ASSIGNED", "EN_ROUTE", "ARRIVED", "COLLECTING"] },
  };
}

async function releaseDriverIfNoActivePickup(driverUserId) {
  if (!driverUserId) return false;
  const activePickup = await PickupRequest.findOne(activePickupFilter(driverUserId))
    .select("_id")
    .lean();
  if (activePickup) return false;

  await Driver.updateOne(
    { userId: driverUserId },
    { $set: { isAvailable: true, updatedAt: new Date() } }
  );
  return true;
}

export async function expireStalePendingPickups({ customerId = null } = {}) {
  const now = new Date();
  const filter = {
    status: "PENDING",
    expiresAt: { $lte: now },
    ...(customerId && { customerId }),
  };

  const stalePickups = await PickupRequest.find(filter)
    .select("_id customerId driverId")
    .lean();

  if (stalePickups.length === 0) {
    return { matched: 0, modified: 0 };
  }

  const ids = stalePickups.map((pickup) => pickup._id);
  const result = await PickupRequest.updateMany(
    { _id: { $in: ids }, status: "PENDING" },
    {
      $set: { status: "EXPIRED" },
      $push: {
        statusHistory: {
          from: "PENDING",
          to: "EXPIRED",
          at: now,
          by: { userId: null, role: "system", name: "PickupExpiry" },
          note: "No driver accepted before the request expired.",
        },
      },
    }
  );

  const modifiedCount = result.modifiedCount || 0;
  if (modifiedCount > 0) {
    const driverIds = [
      ...new Set(stalePickups.map((pickup) => pickup.driverId?.toString()).filter(Boolean)),
    ];
    await Promise.all(driverIds.map((driverId) => releaseDriverIfNoActivePickup(driverId)));

    await PickupEvent.insertMany(
      stalePickups.map((pickup) => ({
        pickupId: pickup._id,
        event: "EXPIRED",
        performedBy: { userId: null, role: "system", name: "PickupExpiry" },
        fromStatus: "PENDING",
        toStatus: "EXPIRED",
        metadata: { reason: "No driver accepted before expiresAt" },
      })),
      { ordered: false }
    ).catch((err) => console.error("[PickupExpiry] Failed to log events:", err.message));

    try {
      const io = getIO();
      for (const pickup of stalePickups) {
        io.to(`customer:${pickup.customerId}`).emit("pickup:status", {
          id: pickup._id,
          status: "EXPIRED",
        });
        io.to(`customer:${pickup.customerId}`).emit("pickup:statusUpdate", {
          id: pickup._id,
          status: "EXPIRED",
        });
      }
      io.to("admins").emit("pickup:expired", { ids });
    } catch {
      // Socket server may not be initialized during scripts/tests.
    }
  }

  return { matched: stalePickups.length, modified: modifiedCount };
}
