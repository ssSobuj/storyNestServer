import User from "../models/User";
import logger from "./logger";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const seedSuperAdmin = async (): Promise<void> => {
  // 1. Get the super admin email from environment variables
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;

  if (!superAdminEmail) {
    logger.warn(
      "SUPER_ADMIN_EMAIL is not defined in the environment variables. Skipping super admin seeding."
    );
    return;
  }

  try {
    // 2. Find the user with the specified email
    const user = await User.findOne({ email: superAdminEmail });

    if (!user) {
      // If the user doesn't exist yet, log a message.
      // The user must first register through the normal process.
      logger.info(
        `Super admin with email ${superAdminEmail} not found. Please ensure this user has registered.`
      );
      return;
    }

    // 3. If the user exists but their role is not 'super-admin', update it
    if (user.role !== "super-admin") {
      user.role = "super-admin";
      await user.save();
      logger.info(
        `Successfully promoted user ${superAdminEmail} to super-admin.`
      );
    } else {
      // If the user is already a super-admin, do nothing
      logger.info(`User ${superAdminEmail} is already a super-admin.`);
    }
  } catch (error) {
    logger.error("Error during super admin seeding process:", error);
  }
};

export default seedSuperAdmin;
