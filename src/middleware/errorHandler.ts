// middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Handle OPTIONS requests specifically
  if (req.method === "OPTIONS") {
    return res
      .status(200)
      .setHeader(
        "Access-Control-Allow-Origin",
        process.env.FRONTEND_URL || "http://localhost:3000"
      )
      .setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      )
      .setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
      .setHeader("Access-Control-Allow-Credentials", "true")
      .json({ success: true });
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  logger.error(
    `Error ${statusCode}: ${message} - ${req.method} ${req.originalUrl}`
  );

  // Add this after setting statusCode/message
  if (err.code === 11000) {
    // MongoDB duplicate key
    const field = Object.keys(err.keyValue)[0];
    statusCode = 400;
    message = `Duplicate field value for ${field}. Please use another value.`;
  }
  res.status(statusCode).json({
    success: false,
    error: message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

export default errorHandler;
