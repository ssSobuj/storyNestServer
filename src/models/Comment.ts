// src/models/Comment.ts

import mongoose, { Document, Schema, Model } from "mongoose";
import { IStory } from "./Story"; // Import the Story interface
// Define an interface for the Story model to access its statics
interface IStoryModel extends Model<IStory> {
  recalculateAvgRating(storyId: string): Promise<void>;
}
export interface IComment extends Document {
  text: string;
  author: mongoose.Types.ObjectId;
  story: mongoose.Types.ObjectId;
  rating: number; // ==> ADD THIS LINE
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema: Schema<IComment> = new Schema(
  {
    text: {
      type: String,
      required: [true, "Comment text cannot be empty"],
      trim: true,
    },
    // ==> ADD THIS ENTIRE FIELD DEFINITION <==
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: [true, "Please provide a rating between 1 and 5"],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    story: {
      type: Schema.Types.ObjectId,
      ref: "Story",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

CommentSchema.post<IComment>("save", async function () {
  // 'this' refers to the comment document that was just saved.
  // We need to get the Story model and call its static method.
  const StoryModel = mongoose.model<IStory, IStoryModel>("Story");
  await StoryModel.recalculateAvgRating(this.story.toString());
});

export default mongoose.model<IComment>("Comment", CommentSchema);
