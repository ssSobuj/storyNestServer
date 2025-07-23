import { Router } from "express";
import {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  verifyEmail,
  googleLogin,
  refreshToken,
  logout,
  getAllUsers,
} from "../controllers/authController";
import { authorize, protect } from "../middleware/auth";
import { check } from "express-validator";

const router = Router();

router.post(
  "/register",
  [
    check("username", "Username is required").not().isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check(
      "password",
      "Please enter a password with 8 or more characters"
    ).isLength({ min: 8 }),
  ],
  register
);

router.post(
  "/login",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  login
);

router.post("/google", googleLogin); // ==> ADD THIS ROUTE
router.put("/verifyemail/:token", verifyEmail);
router.get("/me", protect, getMe);
router.post("/forgotpassword", forgotPassword);
router.put("/resetpassword/:resettoken", resetPassword);
router.post("/refresh", refreshToken); // <-- ADD THIS
router.post("/logout", logout);
router.get("/users", protect, authorize("admin"), getAllUsers);

export default router;
