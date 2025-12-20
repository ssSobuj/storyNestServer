import mongoose from "mongoose";
import logger from "../utils/logger";

const connectDB = async (): Promise<void> => {
  const maxRetries = 5;
  let retries = 0;

  const attemptConnection = async () => {
    try {
      const MONGO_URI = process.env.MONGO_URI;
      if (!MONGO_URI) {
        throw new Error("❌ MONGO_URI is not defined in environment variables");
      }

      console.log("Attempting to connect to MongoDB...");
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 10000,
        maxPoolSize: 10,
        retryWrites: true,
      });
      console.log("✅ MongoDB connected successfully");
    } catch (error) {
      retries++;
      console.error(
        `❌ MongoDB connection failed (Attempt ${retries}/${maxRetries}):`
      );
      console.error(error instanceof Error ? error.message : error);

      if (retries < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, retries), 30000); // Exponential backoff
        console.log(`⏳ Retrying in ${waitTime / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return attemptConnection();
      } else {
        console.warn(
          "⚠️ Max retries reached. Continuing server startup without database connection."
        );
        console.warn(
          "🔄 The server will attempt to reconnect automatically when database becomes available."
        );
      }
    }
  };

  await attemptConnection();
};

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected. Attempting to reconnect...");
});

mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB reconnected successfully");
});

export default connectDB;
