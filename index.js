const express = require("express");
const cors = require("cors");
const { connection } = require("./config/db");
const { userRouter } = require("./routes/user.route");
const chatRouter = require("./routes/chat.route");
const path = require("path");
const { Webhook } = require("svix");
const { UserModel } = require("./model/user.model");
const http = require("http");
const { Server } = require("socket.io");
const { Expo } = require("expo-server-sdk");  // Import Expo SDK

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

// Expo SDK Setup
let expo = new Expo();  // Initialize Expo SDK

// Helper function to send push notifications
const sendPushNotification = async (pushToken, message) => {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error("Invalid Expo push token");
    return;
  }

  const messages = [{
    to: pushToken,
    sound: 'default',
    title: 'New Message',
    body: message,
  }];

  try {
    const response = await expo.sendPushNotificationsAsync(messages);
    console.log("Push notification sent:", response);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};

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

        // Create a new user in the database
        const newUser = new UserModel({
          clerkId: id,
          username: `${first_name} ${last_name}`.trim(),
          firstName: first_name || "",
          lastName: last_name || "",
          email,
          image: image_url || "",
          gender: gender || "",
        });

        await newUser.save();
        console.log(`✅ User saved: ${newUser.email}`);

        // Send a push notification to the new user (if pushToken is available)
        if (newUser.pushToken) {
          await sendPushNotification(newUser.pushToken, "Welcome to the app!");
        }

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

  socket.on("sendMessage", async ({ senderId, receiverId, message }) => {
    try {
      // Save the message to the database
      const newMessage = new ChatModel({ senderId, receiverId, message });
      await newMessage.save();
      io.emit("newMessage", newMessage);

      // Retrieve the receiver's user data to get the push token
      const receiver = await UserModel.findOne({ clerkId: receiverId });
      if (receiver && receiver.pushToken) {
        // Send a push notification to the receiver
        const notificationMessage = `${senderId} sent you a new message`;
        await sendPushNotification(receiver.pushToken, notificationMessage);
      }

    } catch (error) {
      console.error("❌ Error sending message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
  });
});

// Start Server
server.listen(PORT, async () => {
  try {
    await connection;
    console.log("✅ Connected to DB");
  } catch (error) {
    console.error("❌ Error connecting to DB:", error);
  }
  console.log(`🚀 Server is running on port ${PORT}`);
});
