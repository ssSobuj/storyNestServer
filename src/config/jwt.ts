import jwt from "jsonwebtoken";
import logger from "../utils/logger";

// Immediately load and validate environment variables
if (!process.env.JWT_SECRET) {
  logger.error("JWT_SECRET must be defined in environment variables");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || "15m";
const JWT_COOKIE_EXPIRE = parseInt(process.env.JWT_COOKIE_EXPIRE || "30", 10);

interface TokenPayload {
  id: string;
  role: string;
}

const signToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  } as jwt.SignOptions);
};

const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

export { signToken, verifyToken, JWT_COOKIE_EXPIRE };
