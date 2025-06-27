// src/server.ts

// ==> THE FIX <==
// Import and run this file first. This guarantees all .env variables
// are loaded before any other module in your application tries to use them.
import "./loadEnv";

// All other imports can now safely run
import express from "express";
import cors from "cors";
import connectDB from "./config/db";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes";
import storyRoutes from "./routes/storyRoutes";

const app = express();
// ==> A small but important change: Use process.env here <==
const PORT = process.env.PORT || 5000;

// --- CORRECT MIDDLEWARE ORDER ---

// 1. CORS Middleware
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
app.use(cors(corsOptions));

// 2. Other Middleware
app.use(express.json());
app.use(cookieParser());

// 3. Routes
app.get("/api", (req, res) => {
  res.send("Server is running with DB!");
});
app.use("/api/v1/auth", authRoutes);
// ==> A small typo fix: should probably be '/stories' to match REST conventions
app.use("/api/v1/stories", storyRoutes);

// --- SERVER STARTUP LOGIC ---

const startServer = async () => {
  try {
    console.log("⏳ Attempting to connect to database...");
    await connectDB();
    console.log("✅ Database connected successfully.");

    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Fatal startup error:", err);
    process.exit(1);
  }
};

startServer();
