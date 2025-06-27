import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import logger from "../utils/logger";
import { verifyToken } from "../config/jwt";
import { ParamsDictionary } from "express-serve-static-core";

interface AuthRequest extends Request {
  user?: any;
}

// Protect routes
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Explicitly declare return type as Promise<void>
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: "Not authorized to access this route",
      });
      return; // Just return without value
    }

    try {
      const decoded: any = verifyToken(token);
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        res.status(401).json({
          success: false,
          error: "Token expired, please login again",
        });
        return;
      }

      req.user = await User.findById(decoded.id);
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: "User not found",
        });
        return;
      }

      next();
    } catch (err: any) {
      let errorMessage = "Not authorized to access this route";
      if (err.name === "TokenExpiredError") {
        errorMessage = "Token expired, please login again";
      } else if (err.name === "JsonWebTokenError") {
        errorMessage = "Invalid token";
      }

      logger.error("Token verification error:", err);
      res.status(401).json({
        success: false,
        error: errorMessage,
      });
    }
  } catch (err) {
    next(err); // Pass errors to Express error handler
  }
};

// Grant access to specific roles
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `User role ${req.user?.role} is not authorized`,
      });
      return;
    }
    next();
  };
};
