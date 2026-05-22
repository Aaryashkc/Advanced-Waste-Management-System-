import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import mongoose from "mongoose";

import Area from "../models/Area.model.js";
import Driver from "../models/Driver.model.js";
import Organization from "../models/Organization.model.js";
import Payment from "../models/Payment.model.js";
import PickupEvent from "../models/PickupEvent.model.js";
import PickupRequest from "../models/PickupRequest.model.js";
import PricingConfig from "../models/PricingConfig.model.js";
import User from "../models/User.model.js";
import {
  acceptPickup,
  getAllPickups,
  getPickupDriverRooms,
  getPickup,
  updatePickupStatus,
} from "../controllers/pickup.controller.js";
import {
  esewaSuccess,
  initiatePayment,
  markCashCollected,
} from "../controllers/payment.controller.js";
import { driverOrgRoom } from "../socket/socketServer.js";

const originals = new Map();

function oid(value) {
  return new mongoose.Types.ObjectId(value);
}

function remember(target, key) {
  const restoreKey = `${target.modelName || "object"}.${key}`;
  if (!originals.has(restoreKey)) originals.set(restoreKey, { target, key, value: target[key] });
}

function stub(target, key, value) {
  remember(target, key);
  target[key] = value;
}

function restoreAll() {
  for (const { target, key, value } of originals.values()) {
    target[key] = value;
  }
  originals.clear();
}

function res() {
  return {
    statusCode: 200,
    body: undefined,
    redirectUrl: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      return this;
    },
  };
}

function chain(value, methods = ["select", "lean", "populate", "sort", "skip", "limit"]) {
  const query = {};
  for (const method of methods) query[method] = () => query;
  query.then = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
  return query;
}

function doc(fields) {
  return {
    statusHistory: [],
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
      return this;
    },
    ...fields,
  };
}

function signedEsewaData(fields) {
  const secret = process.env.ESEWA_SECRET_KEY;
  const signedFieldNames = fields.signed_field_names;
  const message = signedFieldNames
    .split(",")
    .map((field) => `${field}=${fields[field]}`)
    .join(",");
  const signature = crypto.createHmac("sha256", secret).update(message, "utf8").digest("base64");
  return Buffer.from(JSON.stringify({ ...fields, signature })).toString("base64");
}

test.beforeEach(() => {
  process.env.FRONTEND_URL = "http://frontend.test";
  process.env.BACKEND_URL = "http://backend.test";
  process.env.ESEWA_PRODUCT_CODE = "EPAYTEST";
  process.env.ESEWA_SECRET_KEY = "test-secret";
  stub(PickupEvent, "create", async () => ({}));
  stub(Area, "findOne", () => chain({
    _id: oid("64b00000000000000000a001"),
    name: "Ward 1",
    orgId: oid("64b000000000000000000003"),
  }));
  stub(Area, "find", () => chain([]));
  stub(Area, "exists", async () => true);
  stub(Organization, "findById", async (id) => ({
    _id: id,
    name: "Test Org",
    location: { latitude: 27.7, longitude: 85.3, address: "Depot" },
  }));
  stub(PricingConfig, "findOne", () => chain({
    categoryBase: { recyclable: 85, nonRecyclable: 85, mixed: 85 },
    levelMultiplier: { easy: 1, medium: 1, hard: 1 },
    distanceRatePerKm: 0,
    minimumCharge: 1,
    currency: "NPR",
  }));
  stub(PricingConfig, "create", async () => ({ _id: oid("64b00000000000000000a002") }));
  stub(PricingConfig, "findById", () => chain({
    categoryBase: { recyclable: 85, nonRecyclable: 85, mixed: 85 },
    levelMultiplier: { easy: 1, medium: 1, hard: 1 },
    distanceRatePerKm: 0,
    minimumCharge: 1,
    currency: "NPR",
  }));
});

test.afterEach(() => {
  restoreAll();
  delete global.fetch;
});

test("pickup driver socket rooms use matched drivers or the scoped org room", () => {
  const orgId = oid("64b000000000000000000090");
  const driverA = oid("64b000000000000000000091");
  const driverB = oid("64b000000000000000000092");

  assert.equal(driverOrgRoom(orgId), `driver-org:${orgId}`);
  assert.deepEqual(
    getPickupDriverRooms({ orgId, matchedDriverIds: [] }),
    [`driver-org:${orgId}`]
  );
  assert.deepEqual(
    getPickupDriverRooms({ orgId, matchedDriverIds: [driverA, driverB] }),
    [`driver:${driverA}`, `driver:${driverB}`]
  );
  assert.deepEqual(
    getPickupDriverRooms({ orgId: null, matchedDriverIds: [] }),
    []
  );
});

test("pickup driver socket rooms include the assigned driver without using a global drivers room", () => {
  const orgId = oid("64b000000000000000000093");
  const assignedDriver = oid("64b000000000000000000094");

  const rooms = getPickupDriverRooms(
    { orgId, matchedDriverIds: [], driverId: assignedDriver },
    { includeAssignedDriver: true }
  );

  assert.deepEqual(rooms, [`driver-org:${orgId}`, `driver:${assignedDriver}`]);
  assert.equal(rooms.includes("drivers"), false);
});

test("payment initiation ignores client-supplied amount and uses the recomputed server price", async () => {
  const customerId = oid("64b000000000000000000001");
  const pickupId = oid("64b000000000000000000002");
  const orgId = oid("64b000000000000000000003");
  const pickup = doc({
    _id: pickupId,
    customerId,
    orgId,
    status: "PAYMENT_REQUIRED",
    paymentStatus: "UNPAID",
    location: { latitude: 27.7, longitude: 85.3 },
    category: "recyclable",
    level: "easy",
    area: "Ward 1",
  });
  let createdPayment;

  stub(PickupRequest, "findById", async () => pickup);
  stub(Payment, "findOne", async () => null);
  stub(Payment, "create", async (payload) => {
    createdPayment = { _id: oid("64b000000000000000000004"), ...payload };
    return createdPayment;
  });
  stub(User, "findById", () => chain({ name: "Customer" }));
  stub(PickupRequest, "updateOne", async () => ({ modifiedCount: 1 }));

  const response = res();
  await initiatePayment(
    {
      body: { pickupId: pickupId.toString(), method: "cash", amount: 1 },
      user: { _id: customerId, role: "customer_admin" },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(createdPayment.amount, 85);
  assert.equal(pickup.estimatedPrice, 85);
  assert.equal(response.body.payment.amount, 85);
});

test("eSewa callback rejects tampered callback amounts before settlement", async () => {
  const pickupId = oid("64b000000000000000000010");
  const paymentId = oid("64b000000000000000000011");
  const payment = { _id: paymentId, pickupId, amount: 85, method: "esewa", status: "PENDING" };
  const pickup = doc({
    _id: pickupId,
    orgId: oid("64b000000000000000000012"),
    location: { latitude: 27.7, longitude: 85.3 },
    category: "recyclable",
    level: "easy",
    area: "Ward 1",
  });
  let paymentUpdate = null;
  let pickupUpdateCalled = false;

  stub(Payment, "findOne", async () => payment);
  stub(Payment, "updateOne", async (filter, update) => {
    paymentUpdate = { filter, update };
    return { modifiedCount: 1 };
  });
  stub(Payment, "findOneAndUpdate", async () => {
    throw new Error("settlement should not run for tampered amounts");
  });
  stub(PickupRequest, "findById", async () => pickup);
  stub(PickupRequest, "updateOne", async () => {
    pickupUpdateCalled = true;
    return { modifiedCount: 1 };
  });

  const response = res();
  await esewaSuccess(
    {
      query: {
        data: signedEsewaData({
          transaction_uuid: "MSKY-tampered",
          total_amount: "1",
          signed_field_names: "transaction_uuid,total_amount",
        }),
      },
    },
    response
  );

  assert.match(response.redirectUrl, /payment-failed\?reason=amount_mismatch/);
  assert.equal(paymentUpdate, null);
  assert.equal(pickupUpdateCalled, false);
});

test("unauthorized drivers cannot view or accept a pickup outside their organization", async () => {
  const pickupId = oid("64b000000000000000000020");
  const driverId = oid("64b000000000000000000021");
  const pickupOrgId = oid("64b000000000000000000022");
  const driverOrgId = oid("64b000000000000000000023");
  const pickup = {
    _id: pickupId,
    customerId: oid("64b000000000000000000024"),
    orgId: pickupOrgId,
    matchedDriverIds: [],
    status: "PENDING",
    paymentMethod: "cash",
    paymentStatus: "PENDING",
    expiresAt: new Date(Date.now() + 60_000),
  };
  const driverProfile = {
    _id: oid("64b000000000000000000025"),
    isAvailable: true,
    assignedTruckId: {
      _id: oid("64b000000000000000000026"),
      capacity: 2000,
      dutyType: "medium duty",
      isAvailable: true,
      orgId: driverOrgId,
    },
  };

  stub(PickupRequest, "findById", async () => pickup);
  stub(PickupRequest, "findOne", () => chain(null));
  stub(Driver, "findOne", () => chain(driverProfile));
  stub(Driver, "findOneAndUpdate", async () => {
    throw new Error("driver should not be reserved when eligibility fails");
  });

  const viewResponse = res();
  await getPickup(
    { params: { id: pickupId.toString() }, user: { _id: driverId, role: "driver", orgId: driverOrgId } },
    viewResponse
  );

  const acceptResponse = res();
  await acceptPickup(
    { params: { id: pickupId.toString() }, user: { _id: driverId, role: "driver", orgId: driverOrgId, name: "Driver" } },
    acceptResponse
  );

  assert.equal(viewResponse.statusCode, 403);
  assert.equal(acceptResponse.statusCode, 403);
  assert.equal(acceptResponse.body.message, "Assigned truck is not eligible for this pickup organization");
});

test("admin pickup listing is scoped to the admin organization", async () => {
  const orgId = oid("64b000000000000000000030");
  let filterSeen;

  stub(PickupRequest, "find", (filter) => {
    filterSeen = filter;
    return chain([]);
  });
  stub(PickupRequest, "countDocuments", async (filter) => {
    assert.deepEqual(filter, filterSeen);
    return 0;
  });

  const response = res();
  await getAllPickups(
    { query: {}, user: { _id: oid("64b000000000000000000031"), role: "admin", orgId } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(filterSeen.orgId, orgId);
  assert.equal(response.body.data.pagination.total, 0);
});

test("cancelled pickup eSewa callbacks settle the payment without redispatching the pickup", async () => {
  const pickupId = oid("64b000000000000000000040");
  const paymentId = oid("64b000000000000000000041");
  const payment = { _id: paymentId, pickupId, amount: 85, method: "esewa", status: "PENDING" };
  const pickup = doc({
    _id: pickupId,
    customerId: oid("64b000000000000000000042"),
    orgId: oid("64b000000000000000000043"),
    status: "CANCELLED",
    paymentMethod: "esewa",
    paymentId,
    location: { latitude: 27.7, longitude: 85.3 },
    category: "recyclable",
    level: "easy",
    area: "Ward 1",
  });
  let settled = false;
  let pickupUpdate;

  stub(Payment, "findOne", async () => payment);
  stub(Payment, "findOneAndUpdate", async () => {
    settled = true;
    return { ...payment, status: "COMPLETED" };
  });
  stub(PickupRequest, "findById", async () => pickup);
  stub(PickupRequest, "findOneAndUpdate", async (filter, update) => {
    pickupUpdate = { filter, update };
    return pickup;
  });
  stub(User, "findById", () => chain({ name: "Customer" }));
  global.fetch = async () => ({ ok: true, async json() { return { status: "COMPLETE", ref_id: "REF-1" }; } });

  const response = res();
  await esewaSuccess(
    {
      query: {
        data: signedEsewaData({
          transaction_uuid: "MSKY-cancelled",
          total_amount: "85",
          signed_field_names: "transaction_uuid,total_amount",
        }),
      },
    },
    response
  );

  assert.equal(settled, true);
  assert.equal(pickupUpdate.filter._id, pickupId);
  assert.equal(pickupUpdate.update.$set.paymentStatus, "PAID");
  assert.equal(pickup.status, "CANCELLED");
  assert.equal(pickup.saveCalls, 0);
  assert.match(response.redirectUrl, /payment-success/);
});

test("cash settlement is only allowed for the assigned driver during collection", async () => {
  const pickupId = oid("64b000000000000000000050");
  const assignedDriverId = oid("64b000000000000000000051");
  const otherDriverId = oid("64b000000000000000000052");

  stub(PickupRequest, "findById", async () => ({
    _id: pickupId,
    driverId: assignedDriverId,
    paymentMethod: "cash",
    paymentStatus: "PENDING",
    status: "ARRIVED",
  }));
  stub(Payment, "findOneAndUpdate", async () => {
    throw new Error("payment must not settle before collection or by another driver");
  });

  const wrongDriverResponse = res();
  await markCashCollected(
    { params: { pickupId: pickupId.toString() }, user: { _id: otherDriverId, role: "driver", name: "Other" } },
    wrongDriverResponse
  );

  const earlyResponse = res();
  await markCashCollected(
    { params: { pickupId: pickupId.toString() }, user: { _id: assignedDriverId, role: "driver", name: "Driver" } },
    earlyResponse
  );

  assert.equal(wrongDriverResponse.statusCode, 403);
  assert.equal(earlyResponse.statusCode, 400);
  assert.equal(earlyResponse.body.message, "Pickup must be in collection before collecting cash");
});

test("cash pickup cannot be completed until cash has been collected", async () => {
  const pickupId = oid("64b000000000000000000060");
  const driverId = oid("64b000000000000000000061");

  stub(PickupRequest, "findOne", () => chain({ paymentMethod: "cash", paymentStatus: "PENDING" }, ["select"]));
  stub(PickupRequest, "findOneAndUpdate", async () => {
    throw new Error("status update must not run before cash is paid");
  });

  const response = res();
  await updatePickupStatus(
    { params: { id: pickupId.toString() }, body: { status: "COMPLETED" }, user: { _id: driverId, role: "driver", name: "Driver" } },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, "Confirm cash payment before completing this pickup");
});

test("eSewa pickup cannot be completed unless payment is paid at completion time", async () => {
  const pickupId = oid("64b000000000000000000062");
  const driverId = oid("64b000000000000000000063");

  stub(PickupRequest, "findOne", () => chain({ paymentMethod: "esewa", paymentStatus: "FAILED" }, ["select"]));
  stub(PickupRequest, "findOneAndUpdate", async () => {
    throw new Error("status update must not run after eSewa payment fails");
  });

  const response = res();
  await updatePickupStatus(
    { params: { id: pickupId.toString() }, body: { status: "COMPLETED" }, user: { _id: driverId, role: "driver", name: "Driver" } },
    response
  );

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.message, "eSewa payment must be paid before completing this pickup");
});

test("driver availability is reserved on accept and released when the active pickup completes", async () => {
  const pickupId = oid("64b000000000000000000070");
  const driverId = oid("64b000000000000000000071");
  const driverProfileId = oid("64b000000000000000000072");
  const orgId = oid("64b000000000000000000073");
  const pickup = {
    _id: pickupId,
    customerId: oid("64b000000000000000000074"),
    orgId,
    matchedDriverIds: [],
    status: "PENDING",
    paymentMethod: "cash",
    paymentStatus: "PENDING",
    expiresAt: new Date(Date.now() + 60_000),
    level: "easy",
    createdAt: new Date(Date.now() - 10_000),
  };
  const driverProfile = {
    _id: driverProfileId,
    isAvailable: true,
    assignedTruckId: {
      _id: oid("64b000000000000000000075"),
      licensePlate: "BA-1-CHA",
      capacity: 2000,
      truckType: "MIXED",
      dutyType: "medium duty",
      isAvailable: true,
      orgId,
    },
  };
  const acceptedPickup = doc({ ...pickup, status: "ASSIGNED", driverId, assignedAt: new Date() });
  const completedPickup = doc({
    ...acceptedPickup,
    status: "COMPLETED",
    paymentStatus: "PAID",
    assignedAt: new Date(Date.now() - 30_000),
  });
  const driverUpdates = [];

  stub(Driver, "findOne", () => chain(driverProfile));
  stub(Driver, "findOneAndUpdate", async (filter, update) => {
    driverUpdates.push({ filter, update });
    return { ...driverProfile, isAvailable: false };
  });
  stub(Driver, "updateOne", async (filter, update) => {
    driverUpdates.push({ filter, update });
    return { modifiedCount: 1 };
  });
  stub(User, "findById", () => chain({ name: "Customer" }));

  let activeCheckCount = 0;
  stub(PickupRequest, "findOne", (filter) => {
    if (filter.status === "COLLECTING") {
      return chain({ paymentMethod: "cash", paymentStatus: "PAID" }, ["select"]);
    }
    activeCheckCount += 1;
    return chain(null);
  });
  stub(PickupRequest, "findById", async () => pickup);
  let updateCount = 0;
  const pickupUpdates = [];
  stub(PickupRequest, "findOneAndUpdate", async (filter, update) => {
    pickupUpdates.push({ filter, update });
    updateCount += 1;
    return updateCount === 1 ? acceptedPickup : completedPickup;
  });

  const acceptResponse = res();
  await acceptPickup(
    { params: { id: pickupId.toString() }, user: { _id: driverId, role: "driver", orgId, name: "Driver", phone: "9800000000" } },
    acceptResponse
  );

  const completeResponse = res();
  await updatePickupStatus(
    { params: { id: pickupId.toString() }, body: { status: "COMPLETED" }, user: { _id: driverId, role: "driver", name: "Driver" } },
    completeResponse
  );

  assert.equal(acceptResponse.statusCode, 200);
  assert.equal(completeResponse.statusCode, 200);
  assert.deepEqual(driverUpdates[0].filter, { _id: driverProfileId, isAvailable: true });
  assert.equal(driverUpdates[0].update.$set.isAvailable, false);
  assert.deepEqual(pickupUpdates[1].filter.$or, [
    { paymentMethod: "cash", paymentStatus: "PAID" },
    { paymentMethod: "esewa", paymentStatus: "PAID" },
  ]);
  assert.deepEqual(driverUpdates.at(-1).filter, { userId: driverId });
  assert.equal(driverUpdates.at(-1).update.$set.isAvailable, true);
  assert.ok(activeCheckCount >= 2);
});
