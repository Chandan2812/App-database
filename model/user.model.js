const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    clerkId: { type: String, unique: true },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    resetCode: { type: String },
    resetCodeExpiry: { type: Date },
    lastLogin: { type: Date },
    nationality: { type: String, default: "" }, // New field
    phone: { type: String, default: "" }, // New field
  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", userSchema);

module.exports = { UserModel };
