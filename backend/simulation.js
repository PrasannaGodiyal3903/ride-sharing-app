require("dotenv").config();
const mongoose = require("mongoose");
const Driver = require("./models/Driver");
const { io } = require("./server");

async function tick() {
  const drivers = await Driver.find().lean();
  const updates = [];

  for (const d of drivers) {

    if (d.status === "busy" && d.routeCoords?.length > 1) {

      const route = d.routeCoords;
      const nextIndex = Math.min(d.routeIndex + 1, route.length - 1);
      const next = route[nextIndex];
      if (nextIndex >= route.length - 1) {

  // 🚗 PHASE 1 → DRIVER REACHED USER
  if (d.rideStatus === "to_user") {

    console.log(`Driver ${d.driverId} reached USER`);

    // ✅ EMIT PICKUP EVENT
    if (io) {
      io.emit("driver:arrived_user", {
        driverId: d.driverId,
        destinationRoute: d.destinationRoute || [],
        destinationEta: d.destinationEta || 0
      });
    }

    updates.push({
      updateOne: {
        filter: { driverId: d.driverId },
        update: {
          $set: {
            lat: next.lat,
            lng: next.lng,
            rideStatus: "to_destination",
            routeCoords: d.destinationRoute || [],
            routeIndex: 0
          }
        }
      }
    });

  }

  // 🏁 PHASE 2 → DRIVER REACHED DESTINATION
  else if (d.rideStatus === "to_destination") {

    console.log(`Driver ${d.driverId} reached DESTINATION`);

    // ✅ EMIT FINAL EVENT
    if (io) {
      io.emit("driver:arrived_destination", {
        driverId: d.driverId
      });
    }

    updates.push({
      updateOne: {
        filter: { driverId: d.driverId },
        update: {
          $set: {
            lat: next.lat,
            lng: next.lng,
            status: "available",
            rideStatus: "idle",
            routeCoords: [],
            routeIndex: 0,
            target: null
          }
        }
      }
    });
  }

}
      // 🔴 ARRIVAL CHECK
      else {
        updates.push({
          updateOne: {
            filter: { driverId: d.driverId },
            update: {
              $set: {
                lat: next.lat,
                lng: next.lng,
                routeIndex: nextIndex
              }
            }
          }
        });
      }

    } else if (d.status === "available") {
      updates.push({
        updateOne: {
          filter: { driverId: d.driverId },
          update: {
            $set: {
              lat: d.lat + (Math.random() - 0.5) * 0.0005,
              lng: d.lng + (Math.random() - 0.5) * 0.0005
            }
          }
        }
      });
    }
  }

  if (updates.length) {
    await Driver.bulkWrite(updates);
  }
}

async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Simulation started");

  setInterval(tick, 1500);
}

start();