import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import { Server } from 'socket.io';
import deviceRoutes from './routes/deviceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

const app = express();
app.use(express.json());
app.use(cors());

// Create HTTP server and wrap it with Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:3000" } // React Frontend URL
});

// Database Connection
mongoose.connect('mongodb://localhost:27017/flood_alert_db')
  .then(() => console.log('MongoDB Connected'));

// Make 'io' accessible in routes
app.set('socketio', io);

// Routes
app.use('/api/devices', deviceRoutes);
app.use('/api/dashboard', dashboardRoutes);

server.listen(5000, () => console.log('Server running on port 5000'));