const express = require("express");
const cors = require("cors");
const { connection } = require("./config/db");
const { userRouter } = require("./routes/user.route");
const bodyParser = require("body-parser"); // Import body-parser
const path = require("path");
const crypto = require("crypto");

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

app.post("/api/webhooks", express.json(), (req, res) => {
  const clerkSecret = process.env.CLERK_WEBHOOK_SECRET; // Store secret in .env
  const signature = req.headers["clerk-signature"];
  const rawBody = JSON.stringify(req.body);

  if (!signature) {
    return res.status(400).send("Missing Clerk signature");
  }

  const expectedSignature = crypto
    .createHmac("sha256", clerkSecret)
    .update(rawBody)
    .digest("hex");

  if (signature !== expectedSignature) {
    return res.status(401).send("Invalid signature");
  }

  const event = req.body;

  if (event.type === "user.created") {
    const user = event.data;
    const userEmail = user.email_addresses[0]?.email_address || "No email";
    console.log(`New user created: ${userEmail}`);
  }

  res.sendStatus(200);
});


app.listen(PORT, async () => {
  try {
    await connection;
    console.log("Connected to DB");
  } catch (error) {}
  console.log(`Server is listening on port ${PORT}`);
});
