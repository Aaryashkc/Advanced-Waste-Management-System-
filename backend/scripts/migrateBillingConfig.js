/**
 * One-time migration: drop old BillingConfig collection so the new schema
 * (customerMonthlyFee + adminMonthlyFee) can be created cleanly.
 *
 * Run: node backend/scripts/migrateBillingConfig.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

async function migrate() {
  await mongoose.connect(MONGO_URI);
  console.log("[migrate] connected");

  const collections = await mongoose.connection.db.listCollections({ name: "billingconfigs" }).toArray();
  if (collections.length > 0) {
    await mongoose.connection.db.dropCollection("billingconfigs");
    console.log("[migrate] dropped old billingconfigs collection");
  } else {
    console.log("[migrate] no billingconfigs collection to drop");
  }

  // Also update any existing Billing docs that lack billedRole
  const result = await mongoose.connection.db.collection("billings").updateMany(
    { billedRole: { $exists: false } },
    { $set: { billedRole: "customer_admin" } }
  );
  console.log(`[migrate] backfilled billedRole on ${result.modifiedCount} billing docs`);

  await mongoose.disconnect();
  console.log("[migrate] done");
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
