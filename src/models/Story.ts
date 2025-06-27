import { Schema, model, Document, Types } from "mongoose";
export enum StoryStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface IStory extends Document {
  title: string;
  content: string;
  author: Types.ObjectId;
  category: string;
  tags: string[];
  status: StoryStatus;
  coverImage: string;
  coverImagePublicId: string;
  readingTime: number;
  avgRating: number;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

const StorySchema = new Schema<IStory>(
  {
    title: {
      type: String,
      required: [true, "Please add a title"],
      trim: true,
      maxlength: [100, "Title cannot be more than 100 characters"],
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
      type: String,
      required: [true, "Please add a category"],
      enum: [
        "Fiction",
        "Non-Fiction",
        "Fantasy",
        "Sci-Fi",
        "Horror",
        "Romance",
      ],
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

export default model<IStory>("Story", StorySchema);
