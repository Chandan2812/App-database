const express = require("express");
const cors = require("cors");
const { connection } = require("./config/db");
const { userRouter } = require("./routes/user.route");
const chatRouter = require("./routes/chat.route");
const path = require("path");
const { Webhook } = require("svix");
const { UserModel } = require("./model/user.model");
const { ChatModel } = require("./model/chat.model");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/user", userRouter);
app.use("/chat", chatRouter);

// Clerk Webhook Setup
const SIGNING_SECRET = process.env.SIGNING_SECRET;

if (!SIGNING_SECRET) {
  throw new Error(
    "Error: Please add SIGNING_SECRET from Clerk Dashboard to .env"
  );
}

app.post("/clerk-webhook", async (req, res) => {
  try {
    const svix_id = req.headers["svix-id"];
    const svix_timestamp = req.headers["svix-timestamp"];
    const svix_signature = req.headers["svix-signature"];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ message: "Error: Missing Svix headers" });
    }

    const payload = req.body;
    const bodyString = JSON.stringify(payload);
    const wh = new Webhook(SIGNING_SECRET);

    let event;
    try {
      event = wh.verify(bodyString, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      });
    } catch (err) {
      console.error("❌ Error verifying webhook:", err);
      return res.status(400).json({ message: "Error: Verification failed" });
    }

    console.log("📩 Webhook Event Data:", event.data);

    if (event.type === "user.created") {
      try {
        const {
          id,
          email_addresses,
          first_name,
          last_name,
          image_url,
          gender,
        } = event.data;
        const email = email_addresses?.[0]?.email_address || "";

        const newUser = new UserModel({
          clerkId: id,
          username: `${first_name} ${last_name}`,
          firstName: first_name || "",
          lastName: last_name || "",
          email,
          image: image_url || "",
          gender: gender || "",
        });

        await newUser.save();
        console.log(`✅ User saved: ${newUser.email}`);
      } catch (error) {
        console.error("❌ Error saving user:", error);
      }
    }

    res.status(200).json({ message: "Webhook received successfully" });
  } catch (error) {
    console.error("❌ Error processing webhook:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Real-time Chat with Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);

  // ✅ Ensure only ONE listener is active per connection
  socket.removeAllListeners("sendMessage");

  socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
    console.log(
      `🔄 Event triggered: sendMessage for receiverId: ${receiverId}`
    );

    try {
      const existingMessage = await ChatModel.findOne({
        senderId,
        receiverId,
        message,
      });

      if (existingMessage) {
        console.warn("⚠️ Duplicate message detected, skipping save.");
        return;
      }

      const newMessage = new ChatModel({ senderId, receiverId, message });
      await newMessage.save();
      console.log("✅ Message saved to database");

      io.emit("newMessage", newMessage);

      const receiver = await UserModel.findOne({ _id: receiverId });

      if (receiver?.pushToken) {
        await sendPushNotification(receiver.pushToken, message);
      }
    } catch (error) {
      console.error("❌ Error sending message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
  });
});

// ✅ Function to send push notifications
async function sendPushNotification(to, message) {
  const notification = {
    to, // Recipient's Expo Push Token
    sound: "default",
    title: "New Message!",
    body: message,
    data: { screen: "chat" },
  };

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(notification),
  });

  console.log("📩 Notification sent to:", to);
}

server.listen(PORT, async () => {
  try {
    await connection;
    console.log("✅ Connected to DB");

    // Drop unique index on clerkId if it exists
    try {
      await UserModel.collection.dropIndex("clerkId_1");
      console.log("✅ Dropped unique index on clerkId");
    } catch (error) {
      console.log(
        "ℹ️ No existing unique index on clerkId, or already removed."
      );
    }
  } catch (error) {
    console.error("❌ Error connecting to DB:", error);
  }
  console.log(`🚀 Server is running on port ${PORT}`);
});
