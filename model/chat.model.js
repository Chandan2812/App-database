const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false }, // ✅ New field to track unread messages
    deletedForReceiver: { type: Boolean, default: false }, // New field
  },
  { timestamps: true }
);

const ChatModel = mongoose.model("Chat", chatSchema);

module.exports = { ChatModel };
