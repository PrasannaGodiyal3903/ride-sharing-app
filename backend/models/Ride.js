const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema(
  {
    userLocation: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    destination: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    driverId: { type: String, default: null },
    status: { type: String, enum: ["requested", "assigned"], default: "requested" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ride", rideSchema);
