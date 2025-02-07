const express = require("express");
const { ChatModel } = require("../model/chat.model");
const { authMiddleware } = require("../middleware/auth.middleware"); // We'll create this next
const chatRouter = express.Router();

// Send a new message
chatRouter.post("/send", async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body;

    if (!receiverId || !message) {
      return res
        .status(400)
        .json({ message: "Receiver ID and message are required." });
    }

    const newChat = new ChatModel({
      senderId,
      receiverId,
      message,
      isRead: false, // ✅ New messages are unread by default
    });
    await newChat.save();

    res.status(201).json({ success: true, chat: newChat });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

// Add an API to Get Unread Messages Count
// This API will return the number of unread messages for a specific user.

chatRouter.get("/unread-messages", async (req, res) => {
  try {
    const { receiverId, senderId } = req.query;

    if (!receiverId || !senderId) {
      return res
        .status(400)
        .json({ message: "Receiver and Sender IDs are required." });
    }

    const unreadCount = await ChatModel.countDocuments({
      senderId,
      receiverId,
      isRead: false,
    });

    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

//  Add an API to Mark Messages as Read
// This API will update unread messages to "read" when a user opens the chat.

chatRouter.post("/mark-as-read", async (req, res) => {
  try {
    const { receiverId, senderId } = req.body;

    if (!receiverId || !senderId) {
      return res
        .status(400)
        .json({ message: "Receiver and Sender IDs are required." });
    }

    await ChatModel.updateMany(
      { senderId, receiverId, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ success: true, message: "Messages marked as read." });
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

// Delete a message (from both sides if sender, from own side if receiver)
chatRouter.delete("/delete/:messageId", async (req, res) => {
  try {
    const { userId } = req.body; // User making the delete request
    const { messageId } = req.params;

    const chat = await ChatModel.findById(messageId);
    console.log(chat.senderId.toString());

    if (!chat) {
      return res.status(404).json({ message: "Message not found." });
    }

    if (chat.senderId.toString() === userId) {
      // Sender deletes it permanently for both sides
      await ChatModel.findByIdAndDelete(messageId);
      return res.json({
        success: true,
        message: "Message deleted from both sides.",
      });
    } else if (chat.receiverId.toString() === userId) {
      // Receiver deletes it only from their side
      await ChatModel.findByIdAndUpdate(messageId, {
        $set: { deletedForReceiver: true },
      });
      return res.json({
        success: true,
        message: "Message deleted from your side.",
      });
    } else {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this message." });
    }
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

module.exports = chatRouter;
