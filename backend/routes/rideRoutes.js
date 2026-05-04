const express = require("express");
const router = express.Router();
const { requestRide } = require("../controllers/rideController");

router.post("/request", requestRide);

module.exports = router;
