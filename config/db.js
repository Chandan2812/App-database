const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.mongo_url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB successfully"))
  .catch(err => console.error("Failed to connect to MongoDB", err));

module.exports = { mongoose };
