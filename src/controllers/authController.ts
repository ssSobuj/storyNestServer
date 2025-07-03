import { Request, Response, NextFunction } from "express";
import User, { IUser } from "../models/User";
import { JWT_COOKIE_EXPIRE } from "../config/jwt";
import bcrypt from "bcryptjs";
import logger from "../utils/logger";
import sendEmail from "../utils/sendEmail";
import crypto from "crypto";
import { validationResult } from "express-validator";
import { OAuth2Client } from "google-auth-library";
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

interface AuthRequest extends Request {
  user?: any;
}

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { username, email, password, role } = req.body;

    const user = await User.create({ username, email, password, role });
    const verificationToken = user.getVerificationToken();
    await user.save({ validateBeforeSave: false }); // Save the user with the token

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    const htmlMessage = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Welcome to StoryNest!</h2>
        <p>Thank you for registering. Please click the button below to verify your email address:</p>
        <a href="${verifyUrl}" target="_blank" style="background-color: #ca8a04; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px;">
          Verify My Email
        </a>
        <p style="margin-top: 20px;">This link will expire in 24 hours.</p>
        <p>If you did not create this account, please ignore this email.</p>
      </div>
    `;

    const textMessage = `
      Welcome to StoryNest!
      Please copy and paste the following URL into your browser to verify your email address:
      \n${verifyUrl}\n
      This link will expire in 24 hours.
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: "StoryNest - Email Verification",
        message: textMessage, // Plain text for clients that don't render HTML
        html: htmlMessage, // The rich HTML version
      });
      res.status(201).json({
        success: true,
        data: "Registration successful. Please check your email to verify your account.",
      });
    } catch (err) {
      // If email fails, remove the user to allow them to try again
      logger.error("Email could not be sent during registration:", err);
      await User.findByIdAndDelete(user._id);
      res.status(500).json({
        success: false,
        error: "Registration failed, please try again.",
      });
      return;
    }
  } catch (err) {
    next(err);
  }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: "Please provide an email and password",
      });
      return;
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
      return;
    }

    if (!user.isVerified) {
      res.status(401).json({
        success: false,
        error: "Please verify your email address before logging in.",
      });
      return;
    }

    if (!(await user.matchPassword(password))) {
      res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
      return;
    }

    const accessToken = user.getSignedToken();
    const refreshToken = await user.getRefreshToken(); // Generate the unhashed token
    await user.save(); // Save the hashed version to the database

    // Send the refresh token in a secure, httpOnly cookie
    const refreshOptions = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as "strict",
    };

    res.cookie("refreshToken", refreshToken, refreshOptions);

    res.status(200).json({
      success: true,
      token: accessToken, // This is the short-lived access token
    });
  } catch (err) {
    next(err);
  }
};

// ==> ADD THIS NEW FUNCTION
// @desc    Login/Register with Google
// @route   POST /api/v1/auth/google
// @access  Public
export const googleLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload) {
      res.status(400).json({ success: false, error: "Invalid Google token" });
      return;
    }

    const { sub: googleId, email, name: username } = payload;

    // Find or create user logic
    let user = await User.findOne({ googleId });

    if (!user) {
      // If no user with this googleId, check if a user with this email already exists
      let existingUser = await User.findOne({ email });
      if (existingUser) {
        // Link the Google account to the existing email account
        existingUser.googleId = googleId;
        user = await existingUser.save();
      } else {
        // Create a new user if no account exists at all
        user = await User.create({
          googleId,
          email,
          username,
          isVerified: true, // Google emails are already verified
        });
      }
    }

    // At this point, we have a user. Let's sign a token for them.
    const appToken = user.getSignedToken();
    const options = {
      expires: new Date(Date.now() + JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    res
      .status(200)
      .cookie("token", appToken, options)
      .json({ success: true, token: appToken });
  } catch (err) {
    next(err);
  }
};

// @desc    Refresh access token
// @route   POST /api/v1/auth/refresh
// @access  Public (but needs a valid refresh token cookie)
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tokenFromCookie = req.cookies.refreshToken;

    if (!tokenFromCookie) {
      res
        .status(401)
        .json({ success: false, error: "Not authorized, no token" });
      return;
    }

    // IMPORTANT: The logic I gave you before had a performance issue.
    // This is still not ideal for millions of users, but it's much better than before.
    // It now only queries users who might have a refresh token.
    const usersWithToken = await User.find({
      refreshToken: { $exists: true },
    }).select("+refreshToken");

    let foundUser: IUser | null = null;
    for (const user of usersWithToken) {
      // Ensure the user has a refreshToken property before comparing
      if (
        user.refreshToken &&
        (await bcrypt.compare(tokenFromCookie, user.refreshToken))
      ) {
        foundUser = user;
        break;
      }
    }

    if (!foundUser) {
      res.clearCookie("refreshToken"); // Clear the invalid token
      res
        .status(403)
        .json({ success: false, error: "Forbidden, invalid refresh token" });
      return;
    }

    // Token is valid, issue a new short-lived access token
    const newAccessToken = foundUser.getSignedToken();

    res.status(200).json({
      success: true,
      token: newAccessToken,
    });
  } catch (err) {
    next(err);
  }
};

// ==> ADD THIS NEW CONTROLLER FUNCTION <==
// @desc    Verify email address
// @route   PUT /api/v1/auth/verifyemail/:token
// @access  Public
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Get the token from the URL and hash it
    const verificationToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    // 2. Find the user by the hashed token & check if it's not expired
    const user = await User.findOne({
      verificationToken,
      verificationTokenExpire: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: "Invalid or expired verification token.",
      });
      return;
    }

    // 3. If found, update the user
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
    await user.save();

    // 4. Log the user in by sending a token
    const token = user.getSignedToken();
    const options = {
      expires: new Date(Date.now() + JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    res.status(200).cookie("token", token, options).json({
      success: true,
      message: "Email verified successfully.",
      token,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    logger.error("Get me error:", err);
    next(err);
  }
};

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      res.status(404).json({
        success: false,
        error: "No user with that email",
      });
      return;
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/v1/auth/resetpassword/${resetToken}`;
    const message = `You requested a password reset. Submit a PUT request to: \n\n ${resetUrl}`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Password reset token",
        message,
      });
      res.status(200).json({ success: true, data: "Email sent" });
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      res.status(500).json({
        success: false,
        error: "Email could not be sent",
      });
    }
  } catch (err) {
    logger.error("Forgot password error:", err);
    next(err);
  }
};

// @route   POST /api/v1/auth/resetpassword

// @desc    Reset password
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resettoken)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: "Invalid token",
      });
      return;
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    const token = user.getSignedToken();
    res.status(200).json({
      success: true,
      token,
    });
  } catch (err) {
    logger.error("Reset password error:", err);
    next(err);
  }
};
