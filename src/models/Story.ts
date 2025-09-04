import mongoose, { Schema, model, Document, Types, Model } from "mongoose";
import { IComment } from "./Comment"; // Make sure the path is correct
import Comment from "./Comment";
import { ICategory } from "./Category";

export enum StoryStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface IStory extends Document {
  title: string;
  content: string;
  slug: string;
  author: Types.ObjectId;
  category: Types.ObjectId | ICategory;
  tags: string[];
  status: StoryStatus;
  coverImage: string;
  coverImagePublicId: string;
  readingTime: number;
  avgRating: number;
  views: number;
  createdAt: Date;
  updatedAt: Date;
  comments: IComment[];
  commentCount: number;
}

interface StoryModel extends Model<IStory> {
  recalculateAvgRating(storyId: string): Promise<void>;
}

const StorySchema = new Schema<IStory, StoryModel>(
  {
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
    },
    slug: {
      type: String,
      required: true,
      unique: true, // Ensures no two stories can have the same slug
      lowercase: true,
    },
    content: {
      type: String,
      required: [true, "Please add content"],
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(StoryStatus),
      default: StoryStatus.PENDING,
    },
    coverImage: {
      type: String,
      default:
        "https://res.cloudinary.com/demo/image/upload/v1625864823/default-story-cover.jpg", // A real default image URL
    },
    coverImagePublicId: {
      type: String,
    },
    readingTime: {
      type: Number,
      default: 0,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Please add a category"],
      validate: {
        validator: function(value: any) {
          return mongoose.Types.ObjectId.isValid(value);
        },
        message: 'Invalid category ID'
      }
    },
    tags: [String],
    avgRating: {
      type: Number,
      default: 0,
      min: [0, "Rating must be at least 0"],
      max: [5, "Rating cannot be more than 5"],
    },
    views: {
      type: Number,
      default: 0,
    },
    commentCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Calculate reading time before saving
StorySchema.pre<IStory>("save", function (next) {
  if (this.isModified("content")) {
    const wordsPerMinute = 200;
    const wordCount = this.content.trim().split(/\s+/).length;
    this.readingTime = Math.ceil(wordCount / wordsPerMinute);
  }
  next();
});

// Virtual for comments
StorySchema.virtual("comments", {
  ref: "Comment",
  localField: "_id",
  foreignField: "story",
  justOne: false,
});

// Cascade delete comments when a story is deleted
StorySchema.pre("deleteOne", { document: true }, async function (next) {
  // await this.model("Comment").deleteMany({ story: this._id });
  next();
});

StorySchema.statics.recalculateAvgRating = async function (storyId: string) {
  try {
    const stats = await Comment.aggregate([
      {
        $match: { story: new Types.ObjectId(storyId) },
      },
      {
        $group: {
          _id: "$story",
          avgRating: { $avg: "$rating" },
        },
      },
    ]);

    if (stats.length > 0) {
      const roundedRating = Math.round(stats[0].avgRating * 10) / 10;

      await this.findByIdAndUpdate(storyId, {
        avgRating: roundedRating,
      });
    } else {
      await this.findByIdAndUpdate(storyId, { avgRating: 0 });
    }
  } catch (err) {
    console.error("Error recalculating average rating:", err);
  }
};

export default model<IStory>("Story", StorySchema);
