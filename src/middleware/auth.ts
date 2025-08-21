// middleware/auth.ts
// You can replace your entire file with this code.

import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import logger from "../utils/logger";
import { verifyToken } from "../config/jwt";

interface AuthRequest extends Request {
  user?: any;
}

// Protect routes
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token;

  // 1. Get token from header or cookies
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.token) {
    // This is less common if storing token in localStorage on front-end,
    // but good for flexibility.
    token = req.cookies.token;
  }

  // 2. Make sure token exists
  if (!token) {
    res.status(401).json({
      success: false,
      error: "Not authorized, no token provided.",
    });
    return;
  }

  try {
    // 3. Verify token and find the user
    // The verifyToken function will throw an error if the token is invalid or expired.
    const decoded: any = verifyToken(token);

    // Attach user to the request object
    req.user = await User.findById(decoded.id);

    // Check if user still exists in the database
    if (!req.user) {
      res.status(401).json({ success: false, error: "User not found." });
      return;
    }

    // If everything is okay, proceed to the next middleware/controller
    next();
  } catch (err: any) {
    // 4. Handle token verification errors
    let errorMessage = "Not authorized, token failed.";

    // Handle different errors appropriately.
    if (err.name === "TokenExpiredError") {
      // This is an expected event. Log it as 'info', not 'error'.
      logger.info("Token expired. This is expected. Client should refresh.");
      errorMessage = "Token expired.";
    } else if (err.name === "JsonWebTokenError") {
      // This could be a malformed token, which is more serious. Log as 'warn'.
      logger.warn(`Invalid token received: ${err.message}`);
      errorMessage = "Invalid token.";
    } else {
      // For any other unexpected errors, log it as a real error.
      logger.error("Unexpected token verification error:", err);
    }

    // Always respond with 401 Unauthorized for any token failure.
    // This is what the frontend interceptor is listening for.
    res.status(401).json({
      success: false,
      error: errorMessage,
    });
  }
};

// Grant access to specific roles
// export const authorize = (...roles: string[]) => {
//   return (req: AuthRequest, res: Response, next: NextFunction) => {
//     if (!req.user || !roles.includes(req.user.role)) {
//       res.status(403).json({
//         success: false,
//         error: `User role ${req.user?.role} is not authorized`,
//       });
//       return;
//     }
//     next();
//   };
// };

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // If the user is a super-admin, they have universal access
    if (req.user?.role === "super-admin") {
      return next();
    }

    // Otherwise, check if the user's role is in the allowed roles list
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `User role '${req.user?.role}' is not authorized to access this route`,
      });
      return;
    }
    next();
  };
};
