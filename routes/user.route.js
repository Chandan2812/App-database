const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { UserModel } = require("../model/user.model");
const verifyClerkWebhook = require("../utils/verifyClerkWebhook");

require("dotenv").config();


const userRouter = express.Router();

// Configure Nodemailer
const transporter = nodemailer.createTransport({
  service: "Gmail", // Or any other email service you use
  auth: {
    user: process.env.EMAIL, // Your email address
    pass: process.env.EMAIL_PASSWORD, // Your email password
  },
});

// Route: User Registration with Email Verification
userRouter.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const isUserPresent = await UserModel.findOne({ email });
    if (isUserPresent) {
      return res.send({ msg: "User already present" });
    }

    // Hash the password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Create new user with isVerified set to false
    const user = new UserModel({
      username,
      email,
      password: hashedPassword,
      isVerified: false, // Add this field in your UserModel
    });

    // Save the user
    await user.save();

    // Generate verification token
    const verificationToken = jwt.sign(
      { userId: user._id },
      process.env.jwt_secret,
      {
        expiresIn: "1h", // Token expires in 1 hour
      }
    );

    // Send verification email
    const verificationLink = `https://app-database.onrender.com/user/verify/${verificationToken}`;
    console.log(verificationLink);
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: "Verify Your Email",
      html: `
        <h3>Welcome, ${username}!</h3>
        <p>Click the link below to verify your email:</p>
        <a href="${verificationLink}">verify</a>
        <p>This link will expire in 1 hour.</p>
      `,
    });

    res.send({
      status: "ok",
      msg: "Registration successful! Please verify your email to log in.",
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

// Route: Email Verification
userRouter.get("/verify/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Decode and verify the token
    const decoded = jwt.verify(token, process.env.jwt_secret);

    const userId = decoded.userId;

    // Find and verify the user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).send({ msg: "User not found" });
    }

    if (user.isVerified) {
      return res.send({ msg: "User is already verified" });
    }

    user.isVerified = true;
    await user.save();

    res.send({ msg: "Email verified successfully!" });
  } catch (error) {
    console.error("Verification Error:", error.message);
    res
      .status(400)
      .send({ msg: "Invalid or expired token", error: error.message });
  }
});

// Route: Login with Email Verification Check
userRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const isUserPresent = await UserModel.findOne({ email });
    if (!isUserPresent) {
      return res.send({ msg: "User not present" });
    }

    // Check if email is verified
    if (!isUserPresent.isVerified) {
      return res.send({ msg: "Please verify your email before logging in" });
    }

    // Check password
    const isPasswordMatch = bcrypt.compareSync(
      password,
      isUserPresent.password
    );
    if (!isPasswordMatch) {
      return res.send({ msg: "Wrong credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: isUserPresent._id },
      process.env.jwt_secret
    );

    res.send({
      status: "ok",
      msg: "Login successful",
      token: token,
      user: isUserPresent,
    });
  } catch (error) {
    res.status(500).send({ msg: "Something went wrong", error: error.message });
  }
});

// Route: Fetch All Users
userRouter.get("/", async (req, res) => {
  try {
    const users = await UserModel.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      message: "An error occurred while fetching users.",
      error: error.message,
    });
  }
});

// Route: Forgot Password
userRouter.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Find the user by email
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).send({ msg: "User not found" });
    }

    // Generate a random 6-digit number as a reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000);

    // Save the reset code and its expiration (e.g., 1 hour)
    user.resetCode = resetCode;
    user.resetCodeExpiry = Date.now() + 60 * 60 * 1000; // 1 hour expiration
    await user.save();

    // Send the reset code via email
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: "Reset Your Password",
      html: `
        <h3>Hello, ${user.username}!</h3>
        <p>Use the following code to reset your password:</p>
        <p><strong>${resetCode}</strong></p>
        <p>This code will expire in 1 hour.</p>
      `,
    });

    res.send({ status: "ok", msg: "Password reset code sent to your email" });
  } catch (error) {
    res.status(500).send({ msg: "Something went wrong", error: error.message });
  }
});

// Route: Verify Reset Code
userRouter.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, resetCode } = req.body;

    // Find the user by email
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).send({ msg: "User not found" });
    }

    // Check if the reset code exists and is not expired
    if (user.resetCode !== resetCode) {
      return res.status(400).send({ msg: "Invalid reset code" });
    }

    if (Date.now() > user.resetCodeExpiry) {
      return res.status(400).send({ msg: "Reset code has expired" });
    }

    // If valid, send a success response
    res.send({ status: "ok", msg: "Reset code verified successfully" });
  } catch (error) {
    res.status(500).send({ msg: "Something went wrong", error: error.message });
  }
});

// Route: Reset Password
userRouter.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    // Validate the password and confirmation
    if (newPassword !== confirmPassword) {
      return res.status(400).send({ msg: "Passwords do not match" });
    }

    // Find the user by email
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).send({ msg: "User not found" });
    }

    // Check if the reset code has expired
    if (Date.now() > user.resetCodeExpiry) {
      return res.status(400).send({ msg: "Reset code has expired" });
    }

    // Hash the new password before saving
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    user.password = hashedPassword;

    // Clear reset code and expiry
    user.resetCode = undefined;
    user.resetCodeExpiry = undefined;

    await user.save();

    res.send({ status: "ok", msg: "Password reset successfully" });
  } catch (error) {
    res.status(500).send({ msg: "Something went wrong", error: error.message });
  }
});

// Clerk Webhook endpoint
userRouter.post('/api/clerk-webhook',verifyClerkWebhook, async (req, res) => {
  const { type, data } = req.body;

  try {
    if (type === "user.created") {
      const { id, email_addresses, first_name, last_name } = data;

      // Check if user already exists
      const email = email_addresses[0]?.email_address;
      const isVerified = email_addresses[0]?.verification?.status === "verified";

      const existingUser = await UserModel.findOne({ email });

      if (!existingUser) {
        // Create a new user
        const newUser = new UserModel({
          clerkId: id,
          email,
          username: `${first_name} ${last_name}`.trim(),
          isVerified,
        });

        await newUser.save();
        console.log("New user created:", newUser);
      }
    } else if (type === "user.signed_in") {
      const { id } = data;

      // Update last login time
      const user = await UserModel.findOneAndUpdate(
        { clerkId: id },
        { lastLogin: new Date() },
        { new: true }
      );

      if (user) {
        console.log(`User ${id} logged in. Last login updated.`);
      }
    }

    res.status(200).send("Webhook processed successfully");
  } catch (error) {
    console.error("Error handling webhook:", error);
    res.status(500).send("Error processing webhook");
  }
});

module.exports = { userRouter };
