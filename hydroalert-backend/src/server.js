// src/server.js
import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import { Server } from 'socket.io';
import deviceRoutes from './routes/deviceRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, '../.env')
});

const app = express();
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.set('socketio', io);

io.on('connection', (socket) => {
  console.log(`[Socket] User Connected: ${socket.id}`);

  // Channel Management
  // Dashboard
  socket.on('join_dashboard', () => {
    socket.join('dashboard');
    console.log(`[Socket] User ${socket.id} joined the Dashboard room`);
  });

  socket.on('leave_dashboard', () => {
    socket.leave('dashboard');
    console.log(`[Socket] User ${socket.id} left the Dashboard room`);
  });

  // Sensor Data and Image per Device
  socket.on('join_device', (deviceID) => {
    socket.join(deviceID);
    console.log(`[Socket] User ${socket.id} joined channel: ${deviceID}`);
  });

  socket.on('leave_device', (deviceID) => {
    socket.leave(deviceID);
    console.log(`[Socket] User ${socket.id} left channel: ${deviceID}`);
  });

  // Notification
  socket.on('join_notifications', () => {
    socket.join('notifications');
    console.log(`[Socket] User ${socket.id} joined the Notifications room`);
  });

  socket.on('disconnect', () => {
    console.log('[Socket] User Disconnected');
  });
});

// Database Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/flood_alert_db';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected to:', MONGO_URI))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Swagger Setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Flood Alert System API',
      version: '1.0.0',
      description: 'API for monitoring water levels, managing IoT devices, and alerts.',
    },
    servers: [
      { url: 'https://hydroalert.my.id' }, // Production
      { url: 'http://localhost:5000' }     // Local
    ],
  },
  apis: ['./src/controllers/*.js'], // This points to your controllers
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.get('/api-docs-json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocs);
});

// Routes
app.use('/api/device', deviceRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', notificationRoutes);

server.listen(5000, () => console.log('Server running on port 5000'));