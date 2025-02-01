const express = require("express");
const cors = require("cors");
const { connection } = require("./config/db");
const { userRouter } = require("./routes/user.route");
const bodyParser = require("body-parser"); // Import body-parser
const path = require("path");
const crypto = require("crypto");
const { Webhook } = require("svix");
const { UserModel } = require("./model/user.model");


const PORT = 8080;

require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Apply raw body middleware for Clerk webhook route
// app.use("/user/api/clerk-webhook", bodyParser.raw({ type: "application/json" }));

// All other routes can use express.json()
app.use("/user", userRouter);

const SIGNING_SECRET = process.env.SIGNING_SECRET;

if (!SIGNING_SECRET) {
  throw new Error("Error: Please add SIGNING_SECRET from Clerk Dashboard to .env");
}

app.post("/clerk-webhook", async (req, res) => {
  try {
    const svix_id = req.headers["svix-id"];
    const svix_timestamp = req.headers["svix-timestamp"];
    const svix_signature = req.headers["svix-signature"];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ message: "Missing Svix headers" });
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
      console.error("Webhook verification failed:", err);
      return res.status(400).json({ message: "Verification failed" });
    }

    const { id, email_addresses, first_name, last_name } = event.data;
    const email = email_addresses?.[0]?.email_address || "";

    if (event.type === "user.created") {
      const newUser = new UserModel({
        clerkId: id,
        username: `${first_name} ${last_name}`,
        email: email,
      });

      await newUser.save();
      console.log(`New user added to database: ${email}`);
    }

    res.status(200).json({ message: "Webhook received" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


app.listen(PORT, async () => {
  try {
    await connection;
    console.log("Connected to DB");
  } catch (error) {}
  console.log(`Server is listening on port ${PORT}`);
});
