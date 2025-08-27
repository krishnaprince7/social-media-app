// models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },

    profilePicture: { type: String, default: "" }, // URL of the image
    bio: { type: String, default: "" },

    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post", default: [] }],

    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },

    // Simple anonymous mode flag
    anonymousMode: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
