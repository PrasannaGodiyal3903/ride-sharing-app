const express = require("express");
const router = express.Router();
const { getAllDrivers, updateLocation } = require("../controllers/driverController");

router.get("/", getAllDrivers);
router.post("/location", updateLocation);

module.exports = router;
