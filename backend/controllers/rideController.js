const https    = require("https");
const Driver   = require("../models/Driver");
const Ride     = require("../models/Ride");
const { calcDistance } = require("../utils/distance");
const { activeRides }  = require("../state");

// ── OSRM helper ───────────────────────────────────────────────────────────────
function fetchRoute(fromLat, fromLng, toLat, toLng) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${fromLng},${fromLat};${toLng},${toLat}` +
    `?overview=full&geometries=geojson`;

  return new Promise((resolve) => {
    https.get(url, { timeout: 8000 }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try {
          const json = JSON.parse(raw);
          if (json.code !== "Ok" || !json.routes?.length) return resolve(null);
          const coords = json.routes[0].geometry.coordinates.map(
            ([lng, lat]) => ({ lat, lng })
          );
          resolve({
            coords,
            distanceM:  json.routes[0].distance,  // metres
            durationS:  json.routes[0].duration,  // seconds
          });
        } catch (_) {
          resolve(null);
        }
      });
    })
    .on("error",   () => resolve(null))
    .on("timeout", () => resolve(null));
  });
}

// ── POST /ride/request ────────────────────────────────────────────────────────
const requestRide = async (req, res) => {
  const { userLocation, destination } = req.body;

  if (
    userLocation?.lat == null || userLocation?.lng == null ||
    destination?.lat  == null || destination?.lng  == null
  ) {
    return res
      .status(400)
      .json({ error: "userLocation and destination (lat, lng) are required" });
  }

  try {
    const availableDrivers = await Driver.find({ status: "available" });
    if (!availableDrivers.length)
      return res.status(404).json({ error: "No available drivers at the moment" });

    // Find nearest driver (Euclidean — fast, good enough for matching)
    let nearestDriver = null;
    let minDist = Infinity;

    for (const d of availableDrivers) {
      const dist = calcDistance(userLocation, { lat: d.lat, lng: d.lng });
      if (dist < minDist) { minDist = dist; nearestDriver = d; }
    }
const routeData = await fetchRoute(
  nearestDriver.lat,
  nearestDriver.lng,
  userLocation.lat,
  userLocation.lng
);

const destinationRouteData = await fetchRoute(
  userLocation.lat,
  userLocation.lng,
  destination.lat,
  destination.lng
);

// ✅ NOW use it AFTER declaration
nearestDriver.status = "busy";
nearestDriver.routeCoords = routeData?.coords || [];
nearestDriver.routeIndex = 0;

nearestDriver.destinationRoute = destinationRouteData?.coords || [];
nearestDriver.destinationEta = destinationRouteData?.durationS || 0;

nearestDriver.rideStatus = "to_user";

await nearestDriver.save();
    // Mark driver busy immediately so no double-assign
    nearestDriver.status = "busy";
    nearestDriver.rideStatus = "to_user";
nearestDriver.routeCoords = routeData?.coords || [];
nearestDriver.routeIndex = 0;
nearestDriver.target = {
  lat: userLocation.lat,
  lng: userLocation.lng
};
await nearestDriver.save();

    // Fetch OSRM route driver→user (non-blocking for the response;
    // result stored in activeRides for simulation to consume)


    // Register in shared state — simulation will follow this route
    // activeRides[nearestDriver.driverId] = {
    //   userLocation:  { lat: userLocation.lat, lng: userLocation.lng },
    //   // Pre-populate route if OSRM responded in time; simulation fetches if null
    //   routeCoords:   routeData?.coords    ?? null,
    //   routeIndex:    0,
    //   routeDistanceM: routeData?.distanceM ?? null,
    //   routeDurationS: routeData?.durationS ?? null,
    // };

    const ride = await Ride.create({
      userLocation,
      destination,
      driverId: nearestDriver.driverId,
      status:   "assigned",
    });

    // ETA: use OSRM duration if available, else Euclidean estimate
    const etaSeconds = routeData?.durationS
  ? Math.round(routeData.durationS)
  : Math.round(minDist * 3000); // fallback

    // Route geometry for frontend polyline (driver→user)
    const routeGeometry = routeData?.coords
      ? routeData.coords.map(({ lat, lng }) => [lat, lng])
      : null;

    return res.status(201).json({
      ride,
      assignedDriver:  { driverId: nearestDriver.driverId, lat: nearestDriver.lat, lng: nearestDriver.lng, status: "busy" },
      distanceToDriver: parseFloat(minDist.toFixed(4)),
      distanceM:        routeData?.distanceM   ?? null,
      etaSeconds,
      routeGeometry: routeData?.coords
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { requestRide };