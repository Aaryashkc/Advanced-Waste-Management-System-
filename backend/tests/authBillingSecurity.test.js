import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import test from "node:test";

import { register, requestOTP } from "../controllers/auth.controller.js";
import { payBill } from "../controllers/billing.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { roleMiddleware } from "../middlewares/role.middleware.js";
import Billing from "../models/Billing.model.js";
import User from "../models/User.model.js";

const originals = new Map();

function oid(value) {
  return new mongoose.Types.ObjectId(value);
}

function remember(target, key) {
  const restoreKey = `${target.modelName || target.constructor?.name || "object"}.${key}`;
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
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test.afterEach(() => {
  restoreAll();
});

test("public registration ignores client-supplied privileged role", async () => {
  let savedUser;

  stub(User, "findOne", async () => null);
  stub(User.prototype, "save", async function save() {
    savedUser = this;
    return this;
  });

  const response = res();
  await register(
    {
      body: {
        name: "Customer",
        email: "customer@example.com",
        phone: "9800000000",
        address: "Kathmandu, Nepal",
        role: "super_admin",
      },
    },
    response
  );

  assert.equal(response.statusCode, 201);
  assert.equal(savedUser.role, "customer_admin");
});

test("production OTP request leaves existing OTP untouched when email delivery fails", async () => {
  const envSnapshot = {
    NODE_ENV: process.env.NODE_ENV,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
  };
  process.env.NODE_ENV = "production";
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;

  const previousLoginOtp = {
    hash: "previous-hash",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 2,
    lastSentAt: new Date(Date.now() - 2 * 60 * 1000),
  };
  const user = {
    _id: oid("64b000000000000000000104"),
    email: "customer@example.com",
    loginOtp: { ...previousLoginOtp },
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
      return this;
    },
  };

  stub(User, "findOne", async () => user);

  const response = res();
  try {
    await requestOTP({ body: { email: "customer@example.com" } }, response);
  } finally {
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  assert.equal(response.statusCode, 502);
  assert.deepEqual(user.loginOtp, previousLoginOtp);
  assert.equal(user.saveCalls, 0);
});

test("auth middleware excludes password hash, OTP, and two-factor secret fields", async () => {
  process.env.JWT_SECRET = "test-jwt-secret";
  const userId = oid("64b000000000000000000101");
  const token = jwt.sign({ userId, role: "customer_admin" }, process.env.JWT_SECRET);
  let selectSeen;

  stub(User, "findById", () => ({
    select(selection) {
      selectSeen = selection;
      return Promise.resolve({ _id: userId, role: "customer_admin" });
    },
  }));

  let nextCalled = false;
  const response = res();
  await authMiddleware(
    { headers: { authorization: `Bearer ${token}` } },
    response,
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, true);
  assert.equal(selectSeen, "-passwordHash -loginOtp -twoFactor.secret");
});

test("auth middleware rejects disabled users even with a valid token", async () => {
  process.env.JWT_SECRET = "test-jwt-secret";
  const userId = oid("64b000000000000000000102");
  const token = jwt.sign({ userId, role: "admin" }, process.env.JWT_SECRET);

  stub(User, "findById", () => ({
    select() {
      return Promise.resolve({ _id: userId, role: "admin", isActive: false });
    },
  }));

  let nextError;
  const response = res();
  await authMiddleware(
    { headers: { authorization: `Bearer ${token}` } },
    response,
    (error) => { nextError = error; }
  );

  assert.equal(nextError.statusCode, 403);
  assert.equal(nextError.message, "User account is disabled");
});

test("role middleware fails closed for invalid route role configuration", () => {
  assert.throws(
    () => roleMiddleware("admin", "owner"),
    /Invalid role\(s\) configured: owner/
  );
});

test("role middleware rejects disabled users before role checks", () => {
  const middleware = roleMiddleware("admin");
  let nextError;

  middleware(
    { user: { _id: oid("64b000000000000000000103"), role: "admin", isActive: false } },
    res(),
    (error) => { nextError = error; }
  );

  assert.equal(nextError.statusCode, 403);
  assert.equal(nextError.message, "User account is disabled");
});

test("billing cash payment marks the user's bill as pending admin confirmation", async () => {
  const billingId = oid("64b000000000000000000201");
  const userId = oid("64b000000000000000000202");
  const bill = {
    _id: billingId,
    customerId: userId,
    status: "UNPAID",
    amount: 500,
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
      return this;
    },
  };

  stub(Billing, "findOne", async (filter) => {
    assert.equal(filter._id, billingId.toString());
    assert.equal(filter.customerId, userId);
    return bill;
  });

  const response = res();
  await payBill(
    {
      params: { billingId: billingId.toString() },
      body: { method: "cash" },
      user: { _id: userId, role: "customer_admin", name: "Customer" },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(bill.status, "CASH_PENDING");
  assert.equal(bill.paymentMethod, "cash");
  assert.equal(bill.saveCalls, 1);
  assert.equal(response.body.pendingConfirmation, true);
});
