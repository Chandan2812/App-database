const express = require("express");
const cors = require("cors");
const { connection } = require("./config/db");
const { userRouter } = require("./routes/user.route");
const bodyParser = require("body-parser"); // Import body-parser
const path = require("path");

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

app.post("/clerk-webhook", (req, res) => {
  try {
    const event = req.body;

    if (event.type === "user.created") {
      const user = event.data; // Extract user data

      if (user.email_addresses && user.email_addresses.length > 0) {
        const userEmail = user.email_addresses[0].email_address;
        console.log(`New user created: ${userEmail}`);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Error processing webhook:", error);
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
