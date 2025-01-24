const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  isVerified: { type: Boolean, default: false },
});

const UserModel = mongoose.model("User", userSchema);

module.exports = { UserModel };
