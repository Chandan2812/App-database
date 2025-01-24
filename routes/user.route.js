const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { UserModel } = require("../model/user.model");
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
    const verificationToken = jwt.sign({ userId: user._id }, process.env.jwt_secret, {
      expiresIn: "1h", // Token expires in 1 hour
    });

    // Send verification email
    const verificationLink = `https://app-database.onrender.com/user/verify/${verificationToken}`;
    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: "Verify Your Email",
      html: `
        <h3>Welcome, ${username}!</h3>
        <p>Click the link below to verify your email:</p>
        <a href="${verificationLink}">${verificationLink}</a>
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
    console.log("Decoded Token:", decoded);

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
    res.status(400).send({ msg: "Invalid or expired token", error: error.message });
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
    const isPasswordMatch = bcrypt.compareSync(password, isUserPresent.password);
    if (!isPasswordMatch) {
      return res.send({ msg: "Wrong credentials" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: isUserPresent._id }, process.env.jwt_secret, {
      expiresIn: "4h",
    });

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

module.exports = { userRouter };
