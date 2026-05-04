# 🚗 Ride Sharing Simulation System

A full-stack **real-time ride-hailing simulation** built using **Node.js, Express, MongoDB, Socket.io, and Leaflet**.

This project simulates how apps like Uber/Ola work — including **live driver movement, route tracking, ETA calculation, and ride lifecycle (pickup → destination)**.

---

## ✨ Features

### 🚘 Real-Time Driver Simulation
- Multiple drivers moving dynamically on the map
- Live updates using **Socket.io**
- Idle drivers roam randomly

### 📍 Smart Ride Assignment
- Finds **nearest available driver**
- Assigns ride instantly
- Prevents duplicate assignments

### 🗺 Route-Based Movement
- Uses **OSRM (Open Source Routing Machine)**
- Drivers follow **actual road paths**
- No random movement or “flying markers”

### ⏱ ETA System
- Realistic ETA based on route distance
- Separate ETA for:
  - Pickup
  - Destination

### 🔄 Ride Lifecycle (2 Phase System)
1. 🚗 Driver → User (Pickup)
2. 🚗 User → Destination (Trip)
3. 🏁 Ride Completed

### 🔔 Live Events
- Driver arriving at pickup
- Trip starting automatically
- Arrival at destination

### 🌐 Interactive Map UI
- Built using **Leaflet**
- Real-time markers & route polylines
- Smooth driver movement

---

## 🏗 Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB + Mongoose
- Socket.io

### Frontend
- React (Vite)
- Leaflet (Maps)
- Axios

### Routing
- OSRM API (for real-world routes)

---

## 📁 Project Structure
