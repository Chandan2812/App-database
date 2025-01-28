const crypto = require("crypto");
require("dotenv").config();

const verifyClerkWebhook = (req, res, next) => {
  const signingSecret = process.env.CLERK_WEBHOOK_SECRET; // Set in .env file
  const signature = req.headers["clerk-signature"];

  if (!signingSecret || !signature) {
    return res.status(400).send("Missing signature or secret");
  }

  // Use raw body for verification
  const payload = req.body.toString("utf8");

  const expectedSignature = crypto
    .createHmac("sha256", signingSecret)
    .update(payload)
    .digest("base64");

  if (signature !== expectedSignature) {
    return res.status(400).send("Invalid webhook signature");
  }

  next();
};

module.exports = verifyClerkWebhook;
