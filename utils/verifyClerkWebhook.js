const { Webhook } = require('svix');
require('dotenv').config();

const verifyClerkWebhook = (req, res, next) => {
  const signingSecret = process.env.CLERK_WEBHOOK_SECRET;
  const signature = req.headers['clerk-signature'];

  if (!signingSecret || !signature) {
    return res.status(400).send('Missing signature or secret');
  }

  const payload = JSON.stringify(req.body);

  const webhook = new Webhook(signingSecret);

  try {
    webhook.verify(signature, payload);
    next();
  } catch (err) {
    return res.status(400).send('Invalid webhook signature');
  }
};

module.exports = verifyClerkWebhook;
