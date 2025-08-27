import User from "../models/users.models.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import asynchandler from "../utils/asynchandler.js";

export const createAccount = asynchandler(async (req, res) => {
  const { username, email, password } = req.body;

  const errors = {};

  if (!username) errors.username = "Username is required";
  if (!email) errors.email = "Email is required";
  if (!password) errors.password = "Password is required";

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // Check if username or email already exists
  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "Username or Email already exists",
    });
  }

  // Hash passworde
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create new user
  const newUser = await User.create({
    username,
    email,
    password: hashedPassword,
  });

  // Prepare response without password
  const userResponse = {
    _id: newUser._id,
    username: newUser.username,
    email: newUser.email,
    profilePicture: newUser.profilePicture || "",
    bio: newUser.bio || "",
  };

  res.status(201).json({ success: true, user: userResponse });
});

export const login = asynchandler(async (req, res) => {
  const { identifier, password } = req.body;
  const errors = {};

  if (!identifier) {
    errors.identifier = "Username or Email is required";
  }
  if (!password) {
    errors.password = "Password is required";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  // Find user by username or email
  const user = await User.findOne({
    $or: [{ username: identifier }, { email: identifier }],
  });

  if (!user) {
    return res.status(401).json({ success: false, message: "user not found" });
  }

  // Compare password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res
      .status(401)
      .json({ success: false, message: "Password is incorrect" });
  }

  // ✅ YAHAN STATUS UPDATE KARENGE - Login ke time
  user.isOnline = true;
  user.lastSeen = new Date();
  await user.save();

  // Generate JWT token
  const token = jwt.sign(
    { id: user._id, username: user.username, email: user.email },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "7d" }
  );

  // Send token in HTTP-only cookie + JSON response
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })
    .status(200)
    .json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        profilePicture: user.profilePicture,
        isOnline: user.isOnline, // ✅ Response mein bhejege
        lastSeen: user.lastSeen, // ✅ Response mein bhejege
        token,
      },
    });
});

export const logout = asynchandler(async (req, res) => {
  try {
    // User ko DB se fetch karna (agar token se user milta ho)
    const userId = req.user?.id; // ✅ middleware se aayega (auth middleware lagana hoga)
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        user.isOnline = false;
        user.lastSeen = new Date();
        await user.save();
      }
    }

    // Cookie clear kar do
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Logout failed",
      error: error.message,
    });
  }
});

export const updatePassword = asynchandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  const errors = {};

  if (!oldPassword) errors.oldPassword = "Old password is required";
  if (!newPassword) errors.newPassword = "New password is required";
  if (!confirmPassword) errors.confirmPassword = "Confirm password is required";

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: "New password and confirm password do not match",
    });
  }

  // ✅ User ko auth middleware se fetch karna hoga
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Old password verify
  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    return res
      .status(401)
      .json({ success: false, message: "Old password is incorrect" });
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);

  await user.save();

  res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
});


export const updateProfile = asynchandler(async (req, res) => {
  const { bio, profilePicture } = req.body; // include profilePicture from JSON
  const userId = req.user.id; // from verifyToken middleware

  // Find user
  const user = await User.findById(userId);
  if (!user)
    return res.status(404).json({ success: false, message: "User not found" });

  // Update profilePicture: either file upload or JSON URL
  if (req.file) {
    user.profilePicture = `/uploads/${req.file.filename}`; // multer upload
  } else if (profilePicture) {
    user.profilePicture = profilePicture; // URL from JSON
  }

  // Update bio
  if (bio) user.bio = bio;

  await user.save();

  res.status(200).json({
    success: true,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      bio: user.bio,
    },
  });
});

export const getProfilePicture = asynchandler(async (req, res) => {
  const userId = req.user.id; // from verifyToken middleware

  const user = await User.findById(userId).select("profilePicture");
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  res.status(200).json({
    success: true,
    profilePicture: user.profilePicture || "",
  });
});

export const getCurrentUser = asynchandler(async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password -email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let userData = user.toObject();

    // 👇 Agar anonymousMode true hai to overwrite karo
    if (user.anonymousMode) {
      userData.username = "Unknown User";
      userData.profilePicture = null; // ya koi default placeholder
    }

    res.status(200).json({
      success: true,
      user: userData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
});



export const updatePrivacy = asynchandler(async (req, res) => {
  const { anonymousMode } = req.body;
  if (typeof anonymousMode !== "boolean") {
    return res
      .status(400)
      .json({ success: false, message: "anonymousMode must be boolean" });
  }

  const updated = await User.findByIdAndUpdate(
    req.user.id,
    { anonymousMode },
    { new: true, runValidators: true }
  ).select("_id username profilePicture bio anonymousMode");

  if (!updated) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  return res.json({ success: true, user: updated });
});

export const getUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("username isOnline lastSeen");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      userId: user._id,
      username: user.username,
      isOnline: user.isOnline,
      lastSeen: user.isOnline ? null : user.lastSeen, 
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};