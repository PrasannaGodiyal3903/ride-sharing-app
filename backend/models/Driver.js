const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema({
  driverId: { type: String, required: true, unique: true },
  lat: Number,
  lng: Number,
  
  status: { type: String, enum: ["available", "busy"], default: "available" },
  routeCoords: [{ lat: Number, lng: Number }],
  routeIndex: { type: Number, default: 0 },
  rideStatus: {
  type: String,
  enum: ["idle", "to_user", "to_destination"],
  default: "idle"
},
  // ✅ ADD THIS
  target: {
    lat: Number,
    lng: Number
  }
  
});

module.exports = mongoose.model("Driver", driverSchema);