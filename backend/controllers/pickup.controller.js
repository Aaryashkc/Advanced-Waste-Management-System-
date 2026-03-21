import PickupRequest from "../models/PickupRequest.model.js";
import Driver from "../models/Driver.model.js";
import Truck from "../models/Truck.model.js";
import { getIO } from "../socket/socketServer.js";
import { findBestDrivers } from "../services/driverMatcher.js";

// ── helpers ────────────────────────────────────────────────────────────────

function pickupPayload(doc) {
    return {
        id: doc._id,
        customerId: doc.customerId,
        wasteUploadId: doc.wasteUploadId,
        location: doc.location,
        category: doc.category,
        level: doc.level,
        status: doc.status,
        driverInfo: doc.driverInfo,
        assignedAt: doc.assignedAt,
        expiresAt: doc.expiresAt,
        createdAt: doc.createdAt,
    };
}

// ── POST /api/pickups ──────────────────────────────────────────────────────

/**
 * Customer creates a new pickup request.
 * Uses the knapsack driver-matching algorithm to notify only best-fit drivers.
 * Falls back to broadcasting to all drivers if no matches found.
 */
export const createPickup = async (req, res) => {
    try {
        const { latitude, longitude, address, category, level, wasteUploadId } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ message: "latitude and longitude are required" });
        }

        const customer = req.user;

        // Run the knapsack matching algorithm
        const matched = await findBestDrivers({
            latitude: Number(latitude),
            longitude: Number(longitude),
            category: category || "non-recyclable",
            level: level || "easy",
            orgId: customer.orgId,
        });

        const matchedUserIds = matched.map((m) => m.userId);

        const pickup = await PickupRequest.create({
            customerId: customer._id,
            orgId: customer.orgId,
            wasteUploadId: wasteUploadId || null,
            location: { latitude, longitude, address: address || null },
            category: category || "non-recyclable",
            level: level || "easy",
            matchedDriverIds: matchedUserIds,
        });

        // Emit to matched drivers (or fallback to all)
        try {
            const io = getIO();
            const payload = {
                ...pickupPayload(pickup),
                customerName: customer.name,
            };

            if (matched.length > 0) {
                // Send only to matched drivers via their personal rooms
                matched.forEach((m) => {
                    io.to(`driver:${m.userId}`).emit("pickup:created", payload);
                });
                console.log(`[Pickup] Notified ${matched.length} matched driver(s) for pickup ${pickup._id}`);
            } else {
                // Fallback: broadcast to all online drivers
                io.to("drivers").emit("pickup:created", payload);
                console.log(`[Pickup] No matches found — broadcast to all drivers for pickup ${pickup._id}`);
            }
        } catch (_) {
            // Socket.IO might not yet be attached in test environments; swallow
        }

        return res.status(201).json({
            message: "Pickup request created",
            pickup: pickupPayload(pickup),
        });
    } catch (err) {
        console.error("createPickup error:", err);
        return res.status(500).json({ message: "Failed to create pickup request", error: err.message });
    }
};

// ── GET /api/pickups/:id ───────────────────────────────────────────────────

export const getPickup = async (req, res) => {
    try {
        const pickup = await PickupRequest.findById(req.params.id);
        if (!pickup) return res.status(404).json({ message: "Pickup request not found" });

        // Only the customer who created it or any driver may view it
        const { role, _id } = req.user;
        const isOwner = pickup.customerId.toString() === _id.toString();
        if (role !== "driver" && !isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }

        return res.status(200).json({ pickup: pickupPayload(pickup) });
    } catch (err) {
        console.error("getPickup error:", err);
        return res.status(500).json({ message: "Failed to fetch pickup", error: err.message });
    }
};

// ── GET /api/pickups/active ───────────────────────────────────────────────────

export const getActivePickup = async (req, res) => {
    try {
        const { _id, role } = req.user;
        if (role !== "driver") return res.status(403).json({ message: "Access denied" });

        const activePickup = await PickupRequest.findOne({
            driverId: _id,
            status: { $in: ["EN_ROUTE", "ARRIVED", "COLLECTING"] }
        }).sort({ updatedAt: -1 });

        if (!activePickup) {
            return res.status(200).json({ pickup: null });
        }

        return res.status(200).json({ pickup: pickupPayload(activePickup) });
    } catch (err) {
        console.error("getActivePickup error:", err);
        return res.status(500).json({ message: "Failed to fetch active pickup", error: err.message });
    }
};

// ── GET /api/pickups/pending ───────────────────────────────────────────────

/**
 * Driver fetches all PENDING pickups (for initial load / catch-up).
 * Only returns pickups they are eligible for.
 */
export const getPendingPickups = async (req, res) => {
    try {
        const driverUser = req.user;

        // Find the driver's profile to get truck details if needed for fallback
        const driverProfile = await Driver.findOne({ userId: driverUser._id }).populate(
            "assignedTruckId",
            "truckType"
        );

        if (!driverProfile?.assignedTruckId) {
            return res.status(200).json({ pickups: [] }); // No truck = no pickups
        }

        const truckType = driverProfile.assignedTruckId.truckType;

        // Fetch all logically available pending requests for the driver's org (or null org)
        const pendingPickups = await PickupRequest.find({
            status: "PENDING",
            expiresAt: { $gt: new Date() },
            $or: [{ orgId: driverUser.orgId }, { orgId: null }]
        }).sort({ createdAt: -1 });

        // Filter: only show if driver is explicitly in matchedDriverIds, 
        // OR (if matchedDriverIds is empty meaning fallback broadcast broadcast) 
        // at least check the category compatibility to avoid BIO truck taking non-recyclable.
        const eligiblePickups = pendingPickups.filter(p => {
            // 1. If explicit matches exist, driver must be in the list
            if (p.matchedDriverIds && p.matchedDriverIds.length > 0) {
                return p.matchedDriverIds.some(id => id.toString() === driverUser._id.toString());
            }

            // 2. Fallback: Check category compatibility
            const wasteCategory = p.category || "non-recyclable";
            if (wasteCategory === "recyclable" && truckType === "NON_BIO") return false;
            if (wasteCategory === "non-recyclable" && truckType === "BIO") return false;
            
            return true;
        });

        // Limit to top 20
        return res.status(200).json({ pickups: eligiblePickups.slice(0, 20).map(pickupPayload) });
    } catch (err) {
        console.error("getPendingPickups error:", err);
        return res.status(500).json({ message: "Failed to fetch pickups", error: err.message });
    }
};

// ── POST /api/pickups/:id/accept ───────────────────────────────────────────

/**
 * Driver accepts a pickup request.
 * ATOMIC: uses findOneAndUpdate with status:"PENDING" filter so only one
 * driver can ever succeed.
 */
export const acceptPickup = async (req, res) => {
    try {
        const driverUser = req.user;

        // Get driver profile for truck info
        const driverProfile = await Driver.findOne({ userId: driverUser._id }).populate(
            "assignedTruckId",
            "licensePlate truckType"
        );
        if (!driverProfile) {
            return res.status(404).json({ message: "Driver profile not found" });
        }

        const driverInfo = {
            name: driverUser.name,
            phone: driverUser.phone || null,
            vehicleId: driverProfile.assignedTruckId?.truckType || null,
            licensePlate: driverProfile.assignedTruckId?.licensePlate || null,
        };

        // Atomic update — only succeeds if status is still PENDING
        const updated = await PickupRequest.findOneAndUpdate(
            { _id: req.params.id, status: "PENDING" },
            {
                $set: {
                    status: "ASSIGNED",
                    driverId: driverUser._id,
                    driverInfo,
                    assignedAt: new Date(),
                },
            },
            { new: true }
        );

        if (!updated) {
            // Either not found or already taken
            const exists = await PickupRequest.findById(req.params.id);
            if (!exists) return res.status(404).json({ message: "Pickup request not found" });
            return res.status(409).json({ message: "This request has already been accepted by another driver" });
        }

        const payload = pickupPayload(updated);

        try {
            const io = getIO();
            // Notify the customer
            io.to(`customer:${updated.customerId}`).emit("pickup:accepted", payload);
            // Notify all drivers so they can remove it from their list
            io.to("drivers").emit("pickup:accepted", { id: updated._id, status: "ASSIGNED" });
        } catch (_) { }

        return res.status(200).json({
            message: "Pickup request accepted",
            pickup: payload,
        });
    } catch (err) {
        console.error("acceptPickup error:", err);
        return res.status(500).json({ message: "Failed to accept pickup", error: err.message });
    }
};

// ── POST /api/pickups/:id/cancel ───────────────────────────────────────────

export const cancelPickup = async (req, res) => {
    try {
        const { _id, role } = req.user;

        const pickup = await PickupRequest.findById(req.params.id);
        if (!pickup) return res.status(404).json({ message: "Pickup request not found" });

        // Only the customer who owns it (or admins) can cancel
        const isOwner = pickup.customerId.toString() === _id.toString();
        if (role !== "super_admin" && role !== "admin" && !isOwner) {
            return res.status(403).json({ message: "Access denied" });
        }

        if (!["PENDING", "ASSIGNED"].includes(pickup.status)) {
            return res.status(400).json({ message: `Cannot cancel a request with status: ${pickup.status}` });
        }

        pickup.status = "CANCELLED";
        await pickup.save();

        const payload = pickupPayload(pickup);

        try {
            const io = getIO();
            io.to(`customer:${pickup.customerId}`).emit("pickup:status", payload);
            io.to("drivers").emit("pickup:cancelled", { id: pickup._id });
        } catch (_) { }

        return res.status(200).json({ message: "Pickup request cancelled", pickup: payload });
    } catch (err) {
        console.error("cancelPickup error:", err);
        return res.status(500).json({ message: "Failed to cancel pickup", error: err.message });
    }
};

// ── POST /api/pickups/:id/status ──────────────────────────────────────────

/**
 * Driver updates the pickup status through the task flow.
 * Valid transitions: ASSIGNED → EN_ROUTE → ARRIVED → COLLECTING → COMPLETED
 */
const STATUS_TRANSITIONS = {
    ASSIGNED: "EN_ROUTE",
    EN_ROUTE: "ARRIVED",
    ARRIVED: "COLLECTING",
    COLLECTING: "COMPLETED",
};

export const updatePickupStatus = async (req, res) => {
    try {
        const driverUser = req.user;
        const { status: newStatus } = req.body;

        if (!newStatus) {
            return res.status(400).json({ message: "status is required" });
        }

        const pickup = await PickupRequest.findById(req.params.id);
        if (!pickup) return res.status(404).json({ message: "Pickup request not found" });

        // Only the assigned driver can update
        if (!pickup.driverId || pickup.driverId.toString() !== driverUser._id.toString()) {
            return res.status(403).json({ message: "Only the assigned driver can update status" });
        }

        // Validate transition
        const expectedNext = STATUS_TRANSITIONS[pickup.status];
        if (!expectedNext || expectedNext !== newStatus) {
            return res.status(400).json({
                message: `Invalid transition: ${pickup.status} → ${newStatus}. Expected: ${expectedNext || "none"}`,
            });
        }

        pickup.status = newStatus;
        if (newStatus === "COMPLETED") {
            pickup.completedAt = new Date();
        }
        await pickup.save();

        const payload = pickupPayload(pickup);

        try {
            const io = getIO();
            // Notify the customer with the updated status
            io.to(`customer:${pickup.customerId}`).emit("pickup:statusUpdate", {
                id: pickup._id,
                status: newStatus,
                driverInfo: pickup.driverInfo,
            });
        } catch (_) { }

        return res.status(200).json({ message: `Status updated to ${newStatus}`, pickup: payload });
    } catch (err) {
        console.error("updatePickupStatus error:", err);
        return res.status(500).json({ message: "Failed to update status", error: err.message });
    }
};
