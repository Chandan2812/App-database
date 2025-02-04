const express = require("express");
const { ChatModel } = require("../model/chat.model");
const { authMiddleware } = require("../middleware/auth.middleware"); // We'll create this next
const chatRouter = express.Router();

// Send a new message
chatRouter.post("/send", async (req, res) => {
  try {
    const {senderId, receiverId, message } = req.body;


    if (!receiverId || !message) {
      return res
        .status(400)
        .json({ message: "Receiver ID and message are required." });
    }

    const newChat = new ChatModel({ senderId, receiverId, message });
    await newChat.save();

    res.status(201).json({ success: true, chat: newChat });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

// Get chat messages between two users
chatRouter.get("/messages/:receiverId", async (req, res) => {
  try {
    const senderId = req.query.senderId;
    const { receiverId } = req.params;

    if (!senderId) {
      return res.status(400).json({ message: "Sender ID is required." });
    }

    const chats = await ChatModel.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    }).sort({ timestamp: 1 });

    res.status(200).json({ success: true, messages: chats });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

module.exports = chatRouter;
