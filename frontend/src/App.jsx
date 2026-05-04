import React, {
  useEffect, useRef, useState, useCallback,
} from "react";
import L from "leaflet";
import { io } from "socket.io-client";
import axios from "axios";

// ── Constants ──────────────────────────────────────────────────────────────────
const BACKEND = "http://localhost:3000";
const DELHI   = { lat: 28.6139, lng: 77.209 };
const SPREAD  = 0.04;

const randCoord = (base, s) => base + (Math.random() - 0.5) * 2 * s;
const randDelhi = () => ({ lat: randCoord(DELHI.lat, SPREAD), lng: randCoord(DELHI.lng, SPREAD) });

// ── Icon factories ─────────────────────────────────────────────────────────────
const makeDriverIcon = (status, isAssigned) => {
  const bg =
    isAssigned  ? "#3b82f6" :
    status === "busy" ? "#ef4444" : "#22c55e";
  const ring = isAssigned ? "0 0 0 3px rgba(59,130,246,0.4)" : "none";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:34px;height:34px;background:${bg};
      border:3px solid #fff;border-radius:50%;
      box-shadow:0 2px 10px rgba(0,0,0,0.4),${ring};
      display:flex;align-items:center;justify-content:center;font-size:15px;
      transition:background 0.3s;
    ">🚗</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17],
  });
};

const userIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:30px;height:30px;background:#3b82f6;
    border:3px solid #fff;border-radius:50%;
    box-shadow:0 2px 8px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;font-size:14px;
  ">📍</div>`,
  iconSize: [30, 30], iconAnchor: [15, 15],
});

const destIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:30px;height:30px;background:#f59e0b;
    border:3px solid #fff;border-radius:50%;
    box-shadow:0 2px 8px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;font-size:14px;
  ">🏁</div>`,
  iconSize: [30, 30], iconAnchor: [15, 15],
});

// ── Smooth marker animation ────────────────────────────────────────────────────
// Lerps a marker from its current position toward target over ~500 ms
function animateMarker(marker, targetLat, targetLng) {
  const start    = marker.getLatLng();
  const duration = 600; // ms
  const startMs  = performance.now();

  function step(now) {
    const t = Math.min((now - startMs) / duration, 1);
    // ease-out cubic
    const e = 1 - Math.pow(1 - t, 3);
    marker.setLatLng([
      start.lat + (targetLat - start.lat) * e,
      start.lng + (targetLng - start.lng) * e,
    ]);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── CSS ────────────────────────────────────────────────────────────────────────
const css = `
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --bg:#0c0f14; --surface:#141920; --border:#1e2733;
    --accent:#00e5a0; --accent2:#3b82f6; --warn:#ef4444; --amber:#f59e0b;
    --text:#e8edf5; --muted:#5a6a7e;
    --font:'Syne',sans-serif; --mono:'DM Mono',monospace;
  }
  html,body,#root { height:100%; background:var(--bg); color:var(--text); font-family:var(--font); }

  .layout {
    display:grid;
    grid-template-columns:320px 1fr;
    grid-template-rows:56px 1fr;
    height:100vh;
  }

  .header {
    grid-column:1/-1; display:flex; align-items:center; gap:12px;
    padding:0 24px; background:var(--surface); border-bottom:1px solid var(--border); z-index:10;
  }
  .header-logo { font-size:20px; font-weight:800; letter-spacing:-0.5px; }
  .header-logo span { color:var(--accent); }
  .header-pill {
    margin-left:auto; display:flex; align-items:center; gap:7px;
    padding:4px 12px; border-radius:20px; background:var(--border);
    font-family:var(--mono); font-size:11px; color:var(--muted);
  }
  .header-pill .dot {
    width:7px; height:7px; border-radius:50%;
    background:var(--warn); transition:background 0.4s;
  }
  .header-pill .dot.live { background:var(--accent); animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  .sidebar {
    background:var(--surface); border-right:1px solid var(--border);
    display:flex; flex-direction:column; overflow:hidden;
  }
  .sidebar-section { padding:18px 20px; border-bottom:1px solid var(--border); }
  .sidebar-section:last-child { border-bottom:none; }

  .label {
    font-family:var(--mono); font-size:10px; letter-spacing:1.5px;
    color:var(--muted); text-transform:uppercase; margin-bottom:10px;
  }

  .stats { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .stat-card { background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:12px; }
  .stat-val { font-size:26px; font-weight:800; line-height:1; }
  .stat-val.green { color:var(--accent); }
  .stat-val.red   { color:var(--warn); }
  .stat-label { font-size:11px; color:var(--muted); margin-top:4px; }

  .btn-request {
    width:100%; padding:14px;
    background:var(--accent); color:#000;
    font-family:var(--font); font-size:14px; font-weight:700; letter-spacing:0.5px;
    border:none; border-radius:8px; cursor:pointer;
    transition:opacity 0.2s, transform 0.1s;
  }
  .btn-request:hover:not(:disabled) { opacity:0.88; }
  .btn-request:active:not(:disabled) { transform:scale(0.98); }
  .btn-request:disabled { opacity:0.35; cursor:not-allowed; }
  .btn-request.loading { background:var(--border); color:var(--muted); }

  .result-card {
    margin-top:12px;
    background:var(--bg); border:1px solid var(--border);
    border-radius:8px; padding:14px;
    font-family:var(--mono); font-size:12px; line-height:1.9;
    animation:fadeIn 0.3s ease;
  }
  .result-card.error { border-color:var(--warn); color:var(--warn); }
  .result-key  { color:var(--muted); }
  .result-val  { color:var(--accent);  font-weight:500; }
  .result-val.id   { color:var(--accent2); }
  .result-val.eta  { color:var(--amber); font-size:13px; font-weight:700; }
  .result-val.done { color:var(--accent); }

  /* ETA progress bar */
  .eta-bar-wrap {
    margin-top:8px; height:4px; background:var(--border); border-radius:2px; overflow:hidden;
  }
  .eta-bar {
    height:100%; background:var(--amber); border-radius:2px;
    transition:width 1s linear;
  }
  .eta-bar.arrived { background:var(--accent); }

  @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }

  .driver-list {
    flex:1; overflow-y:auto; padding:10px 12px;
    display:flex; flex-direction:column; gap:5px;
  }
  .driver-list::-webkit-scrollbar { width:4px; }
  .driver-list::-webkit-scrollbar-thumb { background:var(--border); border-radius:4px; }

  .driver-row {
    display:flex; align-items:center; gap:10px;
    padding:7px 10px;
    background:var(--bg); border:1px solid var(--border);
    border-radius:6px; font-family:var(--mono); font-size:11px;
    transition:border-color 0.3s, background 0.3s;
  }
  .driver-row.busy      { border-color:rgba(239,68,68,0.3); }
  .driver-row.assigned  { border-color:var(--accent2); background:rgba(59,130,246,0.08); }
  .driver-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
  .driver-dot.available { background:var(--accent); }
  .driver-dot.busy      { background:var(--warn); }
  .driver-dot.assigned  { background:var(--accent2); }
  .driver-id     { color:var(--text); flex:1; }
  .driver-coords { color:var(--muted); font-size:10px; }

  .map-container { position:relative; overflow:hidden; }
  #map { height:100%; width:100%; }

  .map-badge {
    position:absolute; top:14px; right:14px; z-index:999;
    background:var(--surface); border:1px solid var(--border);
    border-radius:6px; padding:8px 12px;
    font-family:var(--mono); font-size:11px; color:var(--muted);
    pointer-events:none;
  }

  /* Arrival toast */
  .toast {
    position:absolute; bottom:28px; left:50%; transform:translateX(-50%);
    z-index:1000;
    background:#0a2a1a; border:1.5px solid var(--accent);
    border-radius:12px; padding:14px 28px;
    font-family:var(--font); font-size:15px; font-weight:700;
    color:var(--accent); white-space:nowrap;
    box-shadow:0 4px 32px rgba(0,229,160,0.3);
    animation:toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
    pointer-events:none;
  }
  @keyframes toastIn {
    from { opacity:0; transform:translateX(-50%) translateY(20px); }
    to   { opacity:1; transform:translateX(-50%) translateY(0); }
  }

  @media (max-width:700px) {
    .layout { grid-template-columns:1fr; grid-template-rows:56px 260px 1fr; }
  }
`;

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef     = useRef({});        // driverId → L.Marker
  const userMarkerRef  = useRef(null);
  const destMarkerRef  = useRef(null);
  const routeLineRef   = useRef(null);      // L.Polyline for driver→user route
  const followRef      = useRef(false);     // whether to pan map to assigned driver

  const [drivers,       setDrivers]       = useState([]);
  const [connected,     setConnected]     = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [rideResult,    setRideResult]    = useState(null);
  const [lastUpdate,    setLastUpdate]    = useState(null);
  const [toast,         setToast]         = useState(null);
  const [assignedId,    setAssignedId]    = useState(null);  // currently assigned driverId
  const [ridePhase, setRidePhase] = useState("idle");

  // ETA countdown
  const [etaSecondsLeft, setEtaSecondsLeft] = useState(null);
  const [etaTotal,        setEtaTotal]       = useState(null);
  const etaIntervalRef = useRef(null);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      center: [DELHI.lat, DELHI.lng],
      zoom: 13,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap © Carto",
      maxZoom: 19,
    }).addTo(map);
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Clear ETA interval ──────────────────────────────────────────────────────
  const clearEtaInterval = useCallback(() => {
    if (etaIntervalRef.current) {
      clearInterval(etaIntervalRef.current);
      etaIntervalRef.current = null;
    }
  }, []);

  // ── Start ETA countdown ─────────────────────────────────────────────────────
  const startEtaCountdown = useCallback((seconds) => {
    clearEtaInterval();
    setEtaTotal(seconds);
    setEtaSecondsLeft(seconds);
    etaIntervalRef.current = setInterval(() => {
      setEtaSecondsLeft((prev) => {
        if (prev <= 1) { clearEtaInterval(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, [clearEtaInterval]);

  // ── Draw / clear route polyline ─────────────────────────────────────────────
  const drawRoute = useCallback((coords) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null; }
    if (!coords?.length) return;
    routeLineRef.current = L.polyline(coords, {
      color: "#3b82f6",
      weight: 4,
      opacity: 0.75,
      dashArray: "8 6",
    }).addTo(map);
  }, []);

  const clearRoute = useCallback(() => {
    if (routeLineRef.current) { routeLineRef.current.remove(); routeLineRef.current = null; }
  }, []);

  // ── Update Leaflet markers (with smooth animation) ──────────────────────────
  const updateMarkers = useCallback((data, currentAssignedId) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const seen = new Set();

    data.forEach((d) => {
      seen.add(d.driverId);
      const isAssigned = d.driverId === currentAssignedId;
      const icon       = makeDriverIcon(d.status, isAssigned);

      if (markersRef.current[d.driverId]) {
        const m = markersRef.current[d.driverId];
        // Smooth animation instead of snap
        animateMarker(m, d.lat, d.lng);
        m.setIcon(icon);
        m.bindTooltip(`${d.driverId} · ${d.status}`, { permanent: false });
        // Auto-follow assigned driver
        if (isAssigned && followRef.current) {
          map.panTo([d.lat, d.lng], { animate: true, duration: 0.5 });
        }
      } else {
        const m = L.marker([d.lat, d.lng], { icon })
          .addTo(map)
          .bindTooltip(`${d.driverId} · ${d.status}`, { permanent: false });
        markersRef.current[d.driverId] = m;
      }
    });

    // Remove stale markers
    Object.keys(markersRef.current).forEach((id) => {
      if (!seen.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, []);

  // ── Socket.io ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(BACKEND, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("drivers:update", (data) => {
      setDrivers(data);
      setLastUpdate(new Date().toLocaleTimeString());
      setAssignedId((currentId) => {
        updateMarkers(data, currentId);
        return currentId;
      });
    });

    // 🚗 DRIVER REACHED USER
socket.on("driver:arrived_user", ({ driverId, destinationRoute, destinationEta }) => {
  if (driverId !== assignedId) return;

  showToast("🚗 Driver reached you. Starting trip...");
  setRidePhase("to_destination");
  clearEtaInterval();
  setEtaSecondsLeft(0);
  // NEW ROUTE (user → destination)
  if (destinationRoute) {
    drawRoute(destinationRoute);
  }

  // NEW ETA
  if (destinationEta) {
    startEtaCountdown(Math.round(destinationEta));
  }
});


// 🏁 DRIVER REACHED DESTINATION
socket.on("driver:arrived_destination", ({ driverId }) => {
  if (driverId !== assignedId) return;

  showToast("🏁 Arrived at destination!");

  setRidePhase("completed");
  clearEtaInterval();
  setEtaSecondsLeft(0);
  followRef.current = false;
  clearRoute();

  setRideResult((prev) => ({
    data: { ...prev.data, arrived: true }
  }));

  setTimeout(() => setAssignedId(null), 3000);
});

    return () => socket.disconnect();
  }, [showToast, updateMarkers, clearEtaInterval, clearRoute]);

  // ── Request ride ─────────────────────────────────────────────────────────────
  const handleRequestRide = async () => {
    setLoading(true);
    setRideResult(null);
    clearRoute();
    clearEtaInterval();
    setEtaSecondsLeft(null);
    setAssignedId(null);
    setRidePhase("to_user");
    followRef.current = false;

    const userLocation = randDelhi();
    const destination  = randDelhi();

    const map = mapInstanceRef.current;
    if (map) {
      if (userMarkerRef.current) userMarkerRef.current.remove();
      if (destMarkerRef.current) destMarkerRef.current.remove();
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map)
        .bindTooltip("You", { permanent: true, direction: "top" });
      destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon: destIcon })
        .addTo(map)
        .bindTooltip("Destination", { permanent: true, direction: "top" });
    }

    try {
      const res = await axios.post(`${BACKEND}/ride/request`, { userLocation, destination });
      const d   = res.data;

      setAssignedId(d.assignedDriver?.driverId);
      followRef.current = true;

      // Draw route polyline
      if (d.routeGeometry?.length) {
        drawRoute(d.routeGeometry);
      }

      // ETA countdown
      if (d.etaSeconds) startEtaCountdown(Math.round(d.etaSeconds));

      // Fit map to show user + driver + destination
      if (map) {
        const pts = [
          [userLocation.lat, userLocation.lng],
          [destination.lat,  destination.lng],
          [d.assignedDriver.lat, d.assignedDriver.lng],
        ];
        map.fitBounds(pts, { padding: [60, 60], maxZoom: 15 });
      }

      setRideResult({ data: { ...d, arrived: false } });
    } catch (err) {
      setRideResult({ error: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  // ── ETA display helpers ─────────────────────────────────────────────────────
  const fmtEta = (secs) => {
    if (secs == null) return "…";
    if (secs <= 0)    return "Arrived 🎉";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0
      ? `${m}m ${String(s).padStart(2, "0")}s`
      : `${s}s`;
  };
  const etaPct = (etaTotal && etaSecondsLeft != null)
    ? Math.max(0, (etaSecondsLeft / etaTotal) * 100)
    : 100;

  // Derived stats
  const available = drivers.filter((d) => d.status === "available").length;
  const busy      = drivers.filter((d) => d.status === "busy").length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div className="layout">

        {/* Header */}
        <header className="header">
          <div className="header-logo">Ride<span>Watch</span></div>
          <div className="header-pill">
            <div className={`dot ${connected ? "live" : ""}`} />
            {connected ? "LIVE" : "CONNECTING…"}
          </div>
        </header>

        {/* Sidebar */}
        <aside className="sidebar">

          {/* Stats */}
          <div className="sidebar-section">
            <div className="label">Fleet Status</div>
            <div className="stats">
              <div className="stat-card">
                <div className="stat-val green">{available}</div>
                <div className="stat-label">Available</div>
              </div>
              <div className="stat-card">
                <div className="stat-val red">{busy}</div>
                <div className="stat-label">On Ride</div>
              </div>
            </div>
          </div>

          {/* Request */}
          <div className="sidebar-section">
            <div className="label">Request</div>
            <button
              className={`btn-request${loading ? " loading" : ""}`}
              onClick={handleRequestRide}
              disabled={loading || !connected}
            >
              {loading ? "Finding Driver…" : "⚡ Request Ride"}
            </button>

            {rideResult && (
              <>
                {rideResult.error ? (
                  <div className="result-card error">✗ {rideResult.error}</div>
                ) : (
                  <div className="result-card">
                    <div>
                      <span className="result-key">Driver  </span>
                      <span className="result-val id">
                        {rideResult.data.assignedDriver?.driverId}
                      </span>
                    </div>
                    <div>
                      <span className="result-key">Status  </span>
                      <span className="result-val">
                        {
  ridePhase === "completed"
    ? "✓ completed"
    : ridePhase === "to_destination"
    ? "on trip"
    : "going to pickup"
}
                      </span>
                    </div>
                    {rideResult.data.distanceM != null && (
                      <div>
                        <span className="result-key">Distance </span>
                        <span className="result-val">
                          {rideResult.data.distanceM >= 1000
                            ? `${(rideResult.data.distanceM / 1000).toFixed(1)} km`
                            : `${Math.round(rideResult.data.distanceM)} m`}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="result-key">ETA     </span>
                      <span className={`result-val ${rideResult.data.arrived ? "done" : "eta"}`}>
                        {
  ridePhase === "completed"
    ? "Arrived 🎉"
    : ridePhase === "to_destination"
    ? `To Destination: ${fmtEta(etaSecondsLeft)}`
    : `Pickup: ${fmtEta(etaSecondsLeft)}`
}
                      </span>
                    </div>
                    {/* ETA progress bar */}
                    {!rideResult.data.arrived && etaSecondsLeft != null && (
                      <div className="eta-bar-wrap">
                        <div
                          className={`eta-bar${etaSecondsLeft === 0 ? " arrived" : ""}`}
                          style={{ width: `${etaPct}%` }}
                        />
                      </div>
                    )}
                    <div style={{ marginTop: 2 }}>
                      <span className="result-key">Ride ID </span>
                      <span className="result-val id" style={{ fontSize: 10 }}>
                        …{rideResult.data.ride?._id?.slice(-8)}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Driver list */}
          <div className="sidebar-section" style={{ paddingBottom: 8 }}>
            <div className="label">Drivers · {drivers.length}</div>
          </div>
          <div className="driver-list">
            {drivers.length === 0 && (
              <div style={{ color:"var(--muted)", fontSize:12, textAlign:"center", marginTop:20 }}>
                Waiting for drivers…
              </div>
            )}
            {drivers.map((d) => {
              const isAssigned = d.driverId === assignedId;
              return (
                <div
                  key={d.driverId}
                  className={`driver-row ${isAssigned ? "assigned" : d.status}`}
                >
                  <div className={`driver-dot ${isAssigned ? "assigned" : d.status}`} />
                  <span className="driver-id">{d.driverId}</span>
                  <span className="driver-coords">
                    {d.lat.toFixed(4)},{d.lng.toFixed(4)}
                  </span>
                </div>
              );
            })}
          </div>

        </aside>

        {/* Map */}
        <div className="map-container">
          <div id="map" ref={mapRef} />
          {lastUpdate && (
            <div className="map-badge">Updated {lastUpdate}</div>
          )}
          {toast && <div className="toast">{toast}</div>}
        </div>

      </div>
    </>
  );
}
