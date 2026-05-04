/**
 * state.js — shared in-process state between server.js and simulation.js.
 *
 * Both files require() this module. Node caches modules, so they get the
 * exact same object reference — no circular deps, no double-listen.
 *
 * activeRides shape:
 *   driverId -> {
 *     userLocation : { lat, lng }
 *     routeCoords  : [{ lat, lng }, ...]   // OSRM waypoints
 *     routeIndex   : number                // current position in routeCoords
 *     routeDistanceM: number               // total route metres from OSRM
 *   }
 */
const activeRides = {};

module.exports = { activeRides };
