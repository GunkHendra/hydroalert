import express from "express";
import cors from "cors";
// import sensorRoutes from "./routes/sensor.routes.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
// app.use("/api/sensor", sensorRoutes);

export default app;
