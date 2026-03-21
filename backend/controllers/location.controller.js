import Location from "../models/Location.model.js";

// Get all locations for the authenticated user's organization
export const getLocations = async (req, res) => {
    try {
        const { orgId } = req.user;

        // Super admin might want to see all, but for now let's stick to org scoping
        // If user is super_admin, they might not have orgId, handle that if needed
        // For this task, we assume the user interacting with SchedulePage has an orgId

        const query = {};
        if (req.user.role !== 'super_admin' && orgId) {
            query.orgId = orgId;
        } else if (req.user.role === 'super_admin' && req.query.orgId) {
            query.orgId = req.query.orgId;
        }

        const locations = await Location.find(query).sort({ city: 1, area: 1 });

        res.status(200).json(locations);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch locations", error: error.message });
    }
};

// Create a new location (Org Admin only)
export const createLocation = async (req, res) => {
    try {
        const { city, area, address, latitude, longitude } = req.body;
        const { orgId } = req.user;

        if (!city || !area || !address || !latitude || !longitude) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const newLocation = new Location({
            city,
            area,
            address,
            latitude,
            longitude,
            orgId
        });

        await newLocation.save();

        res.status(201).json({ message: "Location created successfully", location: newLocation });
    } catch (error) {
        res.status(500).json({ message: "Failed to create location", error: error.message });
    }
};

// Delete a location
export const deleteLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const location = await Location.findOneAndDelete({ _id: id, orgId: req.user.orgId });

        if (!location) {
            return res.status(404).json({ message: "Location not found" });
        }

        res.status(200).json({ message: "Location deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete location", error: error.message });
    }
};
