/**
 * Calculates Euclidean distance between two (lat, lng) points.
 */
const calcDistance = (loc1, loc2) => {
  const dx = loc2.lat - loc1.lat;
  const dy = loc2.lng - loc1.lng;
  return Math.sqrt(dx * dx + dy * dy);
};

module.exports = { calcDistance };
