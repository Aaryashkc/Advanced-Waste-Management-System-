import mongoose from "mongoose";
import dotenv from "dotenv";
import Area from "../backend/models/Area.model.js";
import Organization from "../backend/models/Organization.model.js";

dotenv.config();

// ─── ANSI helpers ────────────────────────────────────────────────────────────
const c = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  red:     "\x1b[31m",
  cyan:    "\x1b[36m",
  magenta: "\x1b[35m",
  white:   "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgRed:   "\x1b[41m",
};

const ok      = `${c.green}\u2714${c.reset}`;
const warn    = `${c.yellow}\u26A0${c.reset}`;
const fail    = `${c.red}\u2718${c.reset}`;
const arrow   = `${c.dim}\u2192${c.reset}`;
const bullet  = `${c.dim}\u2022${c.reset}`;
const divider = `${c.dim}${"─".repeat(62)}${c.reset}`;

const heading = (text) =>
  console.log(`\n${c.bold}${c.cyan}  ${text}${c.reset}\n${divider}`);

// ─── Mapping configuration ──────────────────────────────────────────────────
const ORG_KEYWORD_MAP = {
  kathmandu: [
    "Kathmandu-Core", "Budhanilkantha", "Tokha", "Chandragiri",
    "Baneshwor", "Koteshwor", "Balaju", "Maharajgunj",
  ],
  lalitpur:  [
    "Lalitpur", "Kirtipur", "Godawari", "Dakshinkali",
    "Satdobato", "Imadol", "Lubhu",
  ],
  bhaktapur: [
    "Bhaktapur", "Madhyapur Thimi", "Suryabinayak", "Changunarayan",
    "Nagarkot",
  ],
};

const AREAS = [
  // Kathmandu (8 areas)
  { name: "Kathmandu-Core",  type: "commercial",  coordinates: { latitude: 27.7172, longitude: 85.3240 } },
  { name: "Baneshwor",       type: "commercial",  coordinates: { latitude: 27.6915, longitude: 85.3420 } },
  { name: "Koteshwor",       type: "commercial",  coordinates: { latitude: 27.6775, longitude: 85.3490 } },
  { name: "Balaju",          type: "residential", coordinates: { latitude: 27.7280, longitude: 85.3050 } },
  { name: "Maharajgunj",     type: "residential", coordinates: { latitude: 27.7350, longitude: 85.3350 } },
  { name: "Budhanilkantha",  type: "suburban",    coordinates: { latitude: 27.7637, longitude: 85.3612 } },
  { name: "Tokha",           type: "suburban",    coordinates: { latitude: 27.7500, longitude: 85.3400 } },
  { name: "Chandragiri",     type: "rural",       coordinates: { latitude: 27.6500, longitude: 85.2200 } },
  // Lalitpur (7 areas)
  { name: "Lalitpur",        type: "commercial",  coordinates: { latitude: 27.6588, longitude: 85.3247 } },
  { name: "Satdobato",       type: "commercial",  coordinates: { latitude: 27.6620, longitude: 85.3300 } },
  { name: "Kirtipur",        type: "residential", coordinates: { latitude: 27.6783, longitude: 85.2789 } },
  { name: "Imadol",          type: "residential", coordinates: { latitude: 27.6550, longitude: 85.3450 } },
  { name: "Lubhu",           type: "suburban",    coordinates: { latitude: 27.6400, longitude: 85.3500 } },
  { name: "Godawari",        type: "rural",       coordinates: { latitude: 27.5900, longitude: 85.3700 } },
  { name: "Dakshinkali",     type: "rural",       coordinates: { latitude: 27.5800, longitude: 85.2600 } },
  // Bhaktapur (5 areas)
  { name: "Bhaktapur",       type: "commercial",  coordinates: { latitude: 27.6710, longitude: 85.4298 } },
  { name: "Madhyapur Thimi", type: "residential", coordinates: { latitude: 27.6817, longitude: 85.3875 } },
  { name: "Suryabinayak",    type: "suburban",    coordinates: { latitude: 27.6600, longitude: 85.4450 } },
  { name: "Changunarayan",   type: "rural",       coordinates: { latitude: 27.7100, longitude: 85.4300 } },
  { name: "Nagarkot",        type: "rural",       coordinates: { latitude: 27.7150, longitude: 85.5200 } },
];

// ─── Main ────────────────────────────────────────────────────────────────────
async function seedAreas() {
  const MONGO_URI = process.env.MONGO_URL;

  if (!MONGO_URI) {
    console.error(`\n  ${fail} ${c.red}MONGO_URL is not defined in .env${c.reset}`);
    console.error(`    Set it in your ${c.bold}.env${c.reset} file and try again.\n`);
    process.exit(1);
  }

  try {
    // ── Step 1: Connect ────────────────────────────────────────────────────
    console.log(`\n  ${bullet} Connecting to MongoDB...`);
    await mongoose.connect(MONGO_URI);
    console.log(`  ${ok} Connected to MongoDB\n`);

    // ── Step 2: Fetch organisations ────────────────────────────────────────
    heading("Organizations");

    const orgs = await Organization.find({}).lean();

    if (orgs.length === 0) {
      console.log(`  ${warn} ${c.yellow}No organizations found in the database.${c.reset}`);
      console.log(`    Areas will be seeded ${c.bold}without${c.reset} org links.`);
      console.log(`    Create organizations first, then re-run this script to link them.\n`);
    } else {
      console.log(`  Found ${c.bold}${orgs.length}${c.reset} organization(s):\n`);
      for (const org of orgs) {
        console.log(`    ${bullet} ${c.bold}${org.name}${c.reset}  ${c.dim}(${org._id})${c.reset}`);
      }
    }

    // ── Step 3: Auto-map areas to orgs via keyword matching ────────────────
    heading("Keyword Matching");

    const areaOrgMap = {};   // areaName -> orgId
    const areaOrgName = {};  // areaName -> orgName (for display)
    let unmatchedKeywords = [];

    for (const [keyword, areaNames] of Object.entries(ORG_KEYWORD_MAP)) {
      const matchedOrg = orgs.find((o) =>
        o.name.toLowerCase().includes(keyword)
      );

      if (matchedOrg) {
        console.log(`  ${ok} ${c.bold}"${keyword}"${c.reset} ${arrow} matched org ${c.green}${matchedOrg.name}${c.reset}`);
        console.log(`    ${c.dim}Areas: ${areaNames.join(", ")}${c.reset}`);
        for (const an of areaNames) {
          areaOrgMap[an] = matchedOrg._id;
          areaOrgName[an] = matchedOrg.name;
        }
      } else {
        unmatchedKeywords.push(keyword);
        console.log(`  ${warn} ${c.yellow}No org matched keyword "${keyword}"${c.reset}`);
        console.log(`    ${c.dim}Areas ${areaNames.join(", ")} will have no org link.${c.reset}`);
      }
    }

    // ── Step 4: Pre-insert summary table ─────────────────────────────────
    heading("Seed Plan");

    const nameW = 20;
    const typeW = 13;
    const orgW  = 22;
    const header =
      `  ${"Area".padEnd(nameW)} ${"Type".padEnd(typeW)} ${"Organization".padEnd(orgW)}`;
    console.log(`${c.bold}${header}${c.reset}`);
    console.log(`  ${"─".repeat(nameW)} ${"─".repeat(typeW)} ${"─".repeat(orgW)}`);

    let linkedCount = 0;
    let unlinkedCount = 0;

    const areasToInsert = AREAS.map((d) => {
      const orgId = areaOrgMap[d.name] || null;
      const orgLabel = areaOrgName[d.name] || null;

      if (orgId) linkedCount++;
      else unlinkedCount++;

      const statusIcon = orgId ? ok : `${c.yellow}-${c.reset}`;
      const orgDisplay = orgLabel
        ? `${c.green}${orgLabel}${c.reset}`
        : `${c.dim}(none)${c.reset}`;

      console.log(
        `  ${statusIcon} ${d.name.padEnd(nameW - 2)} ${d.type.padEnd(typeW)} ${orgDisplay}`
      );

      return { ...d, orgId };
    });

    console.log();
    console.log(`  ${c.bold}Total:${c.reset} ${AREAS.length} areas`);
    console.log(`    ${ok} ${linkedCount} linked to an organization`);
    if (unlinkedCount > 0) {
      console.log(`    ${warn} ${c.yellow}${unlinkedCount} without an organization${c.reset}`);
    }

    // ── Step 5: Clear existing and insert ────────────────────────────────
    heading("Inserting");

    const existingCount = await Area.countDocuments();
    if (existingCount > 0) {
      console.log(`  ${bullet} Removing ${existingCount} existing area(s)...`);
      await Area.deleteMany({});
      console.log(`  ${ok} Cleared.`);
    }

    const inserted = await Area.insertMany(areasToInsert);
    console.log(`  ${ok} Inserted ${c.bold}${inserted.length}${c.reset} areas.`);

    // ── Step 6: Final report ─────────────────────────────────────────────
    heading("Done");

    if (unlinkedCount > 0 && unmatchedKeywords.length > 0) {
      console.log(
        `  ${warn} ${c.yellow}Some areas are unlinked because no org matched: ${unmatchedKeywords.join(", ")}${c.reset}`
      );
      console.log(
        `    Create the missing organization(s) and re-run this script.`
      );
    } else if (unlinkedCount === 0) {
      console.log(`  ${ok} ${c.green}All areas are linked to an organization.${c.reset}`);
    }

    console.log(`\n  ${c.green}${c.bold}Seeding complete.${c.reset}\n`);
    process.exit(0);
  } catch (error) {
    console.error(`\n  ${fail} ${c.red}Seeding failed:${c.reset}`, error.message);
    if (error.code === 11000) {
      console.error(`    ${c.dim}Hint: An area with a duplicate name may already exist.${c.reset}`);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

seedAreas();
