const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    clerkId: { type: String },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false  },
    isVerified: { type: Boolean, default: false },
    resetCode: { type: String },
    resetCodeExpiry: { type: Date },
    lastLogin: { type: Date },
    nationality: { type: String, default: "" }, // New field
    phone: { type: String, default: "" }, // New field
    Gender:{type:String,default:""}, // New field
    image: { type: String, default: "" }, // Field to store the profile image URL
    expoPushToken: { type: String, default: "" },

  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", userSchema);

module.exports = { UserModel };
