import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User from "../backend/models/User.model.js";
import Organization from "../backend/models/Organization.model.js";
import Location from "../backend/models/Location.model.js";
import Driver from "../backend/models/Driver.model.js";
import Truck from "../backend/models/Truck.model.js";
import Schedule from "../backend/models/Schedule.model.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URL;

if (!MONGO_URI) {
    console.error("MONGO_URL is not defined in .env");
    process.exit(1);
}

const seedDatabase = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB...");

        // Clear existing data
        console.log("Clearing existing data...");
        await User.deleteMany({});
        await Organization.deleteMany({});
        await Location.deleteMany({});
        await Driver.deleteMany({});
        await Truck.deleteMany({});
        await Schedule.deleteMany({});

        // 1. Create Super Admin
        console.log("Creating Super Admin...");
        const hashedPassword = await bcrypt.hash("password123", 10);

        const superAdmin = await User.create({
            name: "Super Admin",
            email: "superadmin@maskey.com",
            passwordHash: hashedPassword,
            phone: "9800000000",
            role: "super_admin",
            emailVerified: true,
            phoneVerified: true
        });

        // 2. Create Organization
        console.log("Creating Organization...");
        const org = await Organization.create({
            name: "Kathmandu Waste Management",
            location: {
                latitude: 27.7172,
                longitude: 85.3240,
                address: "Kathmandu, Nepal"
            }
        });

        // 3. Create Org Admin
        console.log("Creating Org Admin...");
        const orgAdmin = await User.create({
            name: "Org Admin",
            email: "admin@ktmwm.com",
            passwordHash: hashedPassword,
            phone: "9841000000",
            role: "customer_admin", // Using the default role for Org Admin
            orgId: org._id,
            emailVerified: true,
            phoneVerified: true
        });

        // 4. Create Locations
        console.log("Creating Locations...");
        const cities = ["Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara"];
        const locationData = [
            { city: "Kathmandu", area: "Maitidevi", lat: 27.7052, lng: 85.3349 },
            { city: "Kathmandu", area: "Thamel", lat: 27.7154, lng: 85.3123 },
            { city: "Kathmandu", area: "Baneshwor", lat: 27.6934, lng: 85.3409 },
            { city: "Kathmandu", area: "Kirtipur", lat: 27.6799, lng: 85.2754 },
            { city: "Lalitpur", area: "Patan", lat: 27.671, lng: 85.3226 },
            { city: "Lalitpur", area: "Jawalakhel", lat: 27.6738, lng: 85.3117 },
            { city: "Bhaktapur", area: "Durbar Square", lat: 27.671, lng: 85.4298 },
            { city: "Bhaktapur", area: "Thimi", lat: 27.6796, lng: 85.3905 },
            { city: "Pokhara", area: "Lakeside", lat: 28.2096, lng: 83.9595 },
            { city: "Pokhara", area: "Mahendrapool", lat: 28.2256, lng: 83.9875 },
        ];

        const locations = await Promise.all(locationData.map(loc =>
            Location.create({
                city: loc.city,
                area: loc.area,
                address: `${loc.area}, ${loc.city}`,
                latitude: loc.lat,
                longitude: loc.lng,
                orgId: org._id
            })
        ));

        // 5. Create Trucks
        console.log("Creating Trucks...");
        const truckTypes = ["BIO", "NON_BIO"];
        const truckPlates = ["BA 1 JA 1234", "BA 2 KHA 5678", "BA 3 PA 9012", "BA 4 CHA 3456", "BA 5 GA 7890"];

        const trucks = await Promise.all(truckPlates.map((plate, idx) =>
            Truck.create({
                truckType: truckTypes[idx % truckTypes.length], // Alternating BIO/NON_BIO
                capacity: 1000 + (idx * 500),
                licensePlate: plate,
                orgId: org._id
            })
        ));

        // 6. Create Drivers
        console.log("Creating Drivers...");
        const driverNames = ["Rajesh Khan", "Sanjay Sharma", "Anil Kumar", "Prakash Rai", "Binod Thapa"];

        const drivers = [];
        for (let i = 0; i < driverNames.length; i++) {
            const name = driverNames[i];
            // Create Driver User
            const driverUser = await User.create({
                name: name,
                email: `driver${i + 1}@ktmwm.com`,
                passwordHash: hashedPassword,
                phone: `981000000${i}`,
                role: "driver",
                orgId: org._id,
                emailVerified: true,
                phoneVerified: true
            });

            // Create Driver Profile
            const driverProfile = await Driver.create({
                userId: driverUser._id,
                currentLocation: {
                    latitude: 27.7172,
                    longitude: 85.3240,
                    address: "Garage"
                },
                assignedTruckId: trucks[i % trucks.length]._id // Assign a truck cyclically
            });

            drivers.push({ user: driverUser, profile: driverProfile });
        }

        // 7. Create Schedules
        console.log("Creating Schedules...");
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const scheduleDuties = ["light duty", "medium duty", "heavy duty"];
        const times = ["~6:00 am", "~7:00 am", "~8:00 am", "~9:00 am", "~6:30 am", "~7:30 am"];

        const schedules = [];
        // Create ~20 schedules
        for (let i = 0; i < 20; i++) {
            const loc = locations[i % locations.length];
            const driver = drivers[i % drivers.length];
            const truck = trucks[i % trucks.length]; // Might mismatch "assignedTruck" vs "schedule truck" but that's okay for seed

            const schedule = await Schedule.create({
                city: loc.city,
                area: loc.area,
                truckId: truck._id,
                driverId: driver.profile._id,
                day: days[i % days.length],
                time: times[i % times.length],
                truckType: scheduleDuties[i % scheduleDuties.length], // Schedule specific duty
                orgId: org._id
            });
            schedules.push(schedule);
        }

        console.log("\n✅ Seeding Complete!");
        console.log("-----------------------------------");
        console.log("Super Admin:");
        console.log("  Email: superadmin@maskey.com");
        console.log("  Password: password123");
        console.log("-----------------------------------");
        console.log("Org Admin:");
        console.log("  Email: admin@ktmwm.com");
        console.log("  Password: password123");
        console.log("-----------------------------------");
        console.log(`Created:`);
        console.log(`  - 1 Organization`);
        console.log(`  - ${locations.length} Locations`);
        console.log(`  - ${trucks.length} Trucks`);
        console.log(`  - ${drivers.length} Drivers`);
        console.log(`  - ${schedules.length} Schedules`);

        process.exit(0);
    } catch (error) {
        console.error("Seeding failed:", error);
        process.exit(1);
    }
};

seedDatabase();
