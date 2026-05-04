const Driver = require("../models/Driver");

// GET /drivers — return all drivers
const getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find();
    res.json(drivers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /driver/location — update or create driver location
const updateLocation = async (req, res) => {
  const { driverId, lat, lng } = req.body;

  if (!driverId || lat == null || lng == null) {
    return res.status(400).json({ error: "driverId, lat, and lng are required" });
  }

  try {
    const driver = await Driver.findOneAndUpdate(
      { driverId },
      { lat, lng },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(driver);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllDrivers, updateLocation };
