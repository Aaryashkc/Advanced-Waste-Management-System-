/**
 * One-shot backfill: assign orgId to historical PickupRequest documents
 * that were created before orgId resolution was added to createPickup.
 *
 * Strategy per pickup with null orgId:
 *   1. If pickup.area matches an Area name → use that Area's orgId.
 *   2. Else find the nearest Area (by GPS) that has an orgId.
 *
 * Usage:
 *   node backend/scripts/backfillPickupOrgId.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import PickupRequest from "../models/PickupRequest.model.js";
import Area from "../models/Area.model.js";

async function main() {
  const uri = process.env.MONGO_URL || process.env.MONGODB_URL;
  if (!uri) throw new Error("MONGO_URL not set");
  await mongoose.connect(uri);
  console.log("[backfill] connected");

  const areas = await Area.find({
    isActive: true,
    orgId: { $ne: null },
    "coordinates.latitude": { $exists: true, $ne: null },
    "coordinates.longitude": { $exists: true, $ne: null },
  }).lean();
  console.log(`[backfill] loaded ${areas.length} candidate areas`);

  const toRad = (d) => (d * Math.PI) / 180;
  const nearest = (lat, lng) => {
    let best = null;
    let min = Infinity;
    for (const a of areas) {
      const dLat = toRad(a.coordinates.latitude - lat);
      const dLng = toRad(a.coordinates.longitude - lng);
      const sLat = Math.sin(dLat / 2);
      const sLng = Math.sin(dLng / 2);
      const h = sLat * sLat + Math.cos(toRad(lat)) * Math.cos(toRad(a.coordinates.latitude)) * sLng * sLng;
      const dist = 2 * 6371 * Math.asin(Math.sqrt(h));
      if (dist < min) { min = dist; best = a; }
    }
    return best;
  };

  const pickups = await PickupRequest.find({ orgId: null }).select("_id area location").lean();
  console.log(`[backfill] ${pickups.length} pickups need orgId`);

  let updated = 0;
  let skipped = 0;
  for (const p of pickups) {
    let area = null;
    if (p.area) area = areas.find((a) => a.name === p.area) || null;
    if (!area && p.location?.latitude != null && p.location?.longitude != null) {
      area = nearest(Number(p.location.latitude), Number(p.location.longitude));
    }
    if (area?.orgId) {
      await PickupRequest.updateOne({ _id: p._id }, { $set: { orgId: area.orgId } });
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`[backfill] done. updated=${updated} skipped=${skipped}`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
