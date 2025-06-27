import { Document } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
      };
    }
  }
}

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: "user" | "admin";
  isVerified: boolean;
  googleId?: string;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  matchPassword: (enteredPassword: string) => Promise<boolean>;
  getSignedToken: () => string;
}

export interface IStory extends Document {
  title: string;
  content: string;
  author: Types.ObjectId;
  category: string;
  tags: string[];
  avgRating: number;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}
