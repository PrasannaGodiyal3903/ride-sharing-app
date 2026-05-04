require("dotenv").config();
const express   = require("express");
const http      = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const Driver    = require("./models/Driver");
const cors = require("cors");
const app = express();
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST"],
}));
app.use(express.json());

connectDB();

// ── Socket.io ─────────────────────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  pingInterval: 10000,
  pingTimeout:  5000,
});

// Export io so simulation.js can emit arrival events
module.exports.io = io;

// ── Routes ────────────────────────────────────────────────────────────────────
const driverRoutes = require("./routes/driverRoutes");
const rideRoutes   = require("./routes/rideRoutes");

app.use("/drivers", driverRoutes);
app.use("/ride",    rideRoutes);
app.get("/", (req, res) => res.json({ message: "Ride Simulation API running" }));

// ── Socket events ─────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  socket.on("disconnect", () =>
    console.log(`[Socket.io] Client disconnected: ${socket.id}`)
  );
});

// Broadcast all driver locations every 2 s
setInterval(async () => {
  try {
    const drivers = await Driver.find().lean();
    io.emit("drivers:update", drivers);
  } catch (err) {
    console.error("[Socket.io] broadcast error:", err.message);
  }
}, 2000);

// ── Listen with safe port fallback ────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3000;

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const fallback = PORT + 1;
    console.warn(`[Server] Port ${PORT} in use — retrying on ${fallback}`);
    server.listen(fallback, () =>
      console.log(`Server running on port ${fallback}`)
    );
  } else {
    console.error("[Server] Fatal:", err.message);
    process.exit(1);
  }
});
module.exports = { io };