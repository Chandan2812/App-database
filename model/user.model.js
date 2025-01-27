// UserModel.js (Mongoose schema for user)
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    resetCode: { type: String }, // Field to store the reset code
    resetCodeExpiry: { type: Date }, // Field to store the reset code expiry time
  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", userSchema);

module.exports = UserModel;
