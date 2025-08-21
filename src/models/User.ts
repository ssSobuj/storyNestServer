import { Schema, model, Document } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { signToken } from "../config/jwt";
import logger from "../utils/logger";

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  refreshToken?: string;
  googleId?: string;
  role: "user" | "admin" | "super-admin";
  isVerified: boolean;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  verificationToken?: string;
  verificationTokenExpire?: Date;
  matchPassword: (enteredPassword: string) => Promise<boolean>;
  getSignedToken: () => string;
  getRefreshToken: () => Promise<string>;
  getResetPasswordToken: () => string;
  getVerificationToken: () => string;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, "Please add a username"],
      unique: true,
      trim: true,
      maxlength: [30, "Username cannot be more than 30 characters"],
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      // required: [true, "Please add a password"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin", "super-admin"],
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    verificationToken: String,
    verificationTokenExpire: Date,

    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Encrypt password using bcrypt
UserSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    logger.error("Password hashing error:", error);
    next(error as Error);
  }
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (
  enteredPassword: string
): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

// Sign JWT and return
UserSchema.methods.getSignedToken = function (): string {
  return signToken({ id: this._id, role: this.role });
};

// Generate, hash, and save refresh token
UserSchema.methods.getRefreshToken = async function (): Promise<string> {
  const refreshToken = crypto.randomBytes(32).toString("hex");

  // Hash the token before saving
  this.refreshToken = await bcrypt.hash(refreshToken, 10);

  // We don't need to call save() here, it will be called in the controller
  // that uses this method (e.g., login).

  return refreshToken; // Return the unhashed token to the user
};

// ==> ADD THIS NEW METHOD FOR EMAIL VERIFICATION <==
UserSchema.methods.getVerificationToken = function (): string {
  // Generate token
  const verificationToken = crypto.randomBytes(20).toString("hex");

  // Hash token and set to verificationToken field
  this.verificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  // Set expire (e.g., 24 hours)
  this.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000;

  return verificationToken; // Return the unhashed token
};

// Generate and hash password reset token
UserSchema.methods.getResetPasswordToken = function (): string {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expire (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

export default model<IUser>("User", UserSchema);
