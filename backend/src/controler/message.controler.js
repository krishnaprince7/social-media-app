import mongoose from "mongoose";
import fs from "fs";
import Message from "../models/message.models.js";
import User from "../models/users.models.js";
import { io, getRoomId } from "../index.js";

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Create a message
 */
export const createMessage = async (req, res) => {
  try {
    const { sender, receiver, text, tempId } = req.body || {};

    // Validate presence
    if (!sender || !receiver) {
      return res.status(400).json({ error: "sender and receiver are required" });
    }

    // Validate ObjectIds
    if (!isValidId(sender) || !isValidId(receiver)) {
      return res.status(400).json({ error: "Invalid sender or receiver id" });
    }

    const payload = {
      sender,
      receiver,
      text: text || "",
      // Fix: Use req.files instead of req.file
      image: req.files?.image?.[0] ? `/uploads/${req.files.image[0].filename}` : null,
      voice: req.files?.voice?.[0] ? `/uploads/${req.files.voice[0].filename}` : null,
      tempId,
    };

    const newMessage = await Message.create(payload);

    // Realtime broadcast for both users/tabs
    try {
      const roomId = getRoomId(sender, receiver);
      io.to(roomId).emit("message", { ...newMessage.toObject(), tempId });
    } catch (e) {
      console.error("Socket emit (message) failed:", e);
    }

    return res.status(201).json(newMessage);
  } catch (err) {
    console.error("Error saving message:", err);
    return res.status(500).json({ error: "Failed to save message" });
  }
};


/**
 * Get all messages in a thread (between two users)
 */
export const getMessages = async (req, res) => {
  try {
    const { senderId, receiverId } = req.params || {};

    // Validate presence
    if (!senderId || !receiverId) {
      return res.status(400).json({ error: "senderId and receiverId are required" });
    }

    // Validate ObjectIds to avoid CastError
    if (!isValidId(senderId) || !isValidId(receiverId)) {
      return res.status(400).json({ error: "Invalid senderId or receiverId" });
    }

    const messages = await Message.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId },
      ],
    })
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .sort({ createdAt: 1 });

    // Fetch receiver minimal info (optional)
    const receiverUser = await User.findById(receiverId, "username profilePicture");

    const receiverInfo = receiverUser
      ? {
          _id: receiverUser._id,
          username: receiverUser.username,
          profilePicture: receiverUser.profilePicture,
        }
      : null;

    // Normalize messages for client
    const formattedMessages = messages.map((msg) => ({
      _id: msg._id,
      sender: msg.sender?._id || msg.sender, // handles both populated and plain ids
      receiver: msg.receiver?._id || msg.receiver,
      text: msg.text,
      image: msg.image,
      voice: msg.voice,
      createdAt: msg.createdAt,
      tempId: msg.tempId || undefined,
    }));

    return res.json({
      receiver: receiverInfo,
      messages: formattedMessages,
    });
  } catch (err) {
    console.error("getMessages error:", err);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
};

/**
 * Delete a message by id (and its file if present)
 */
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params || {};

    if (!messageId) {
      return res.status(400).json({ error: "messageId is required" });
    }
    if (!isValidId(messageId)) {
      return res.status(400).json({ error: "Invalid messageId" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Delete image file if exists (best-effort)
    if (message.image) {
      const imagePath = `.${message.image}`; // e.g., "./uploads/xyz.jpg"
      fs.unlink(imagePath, (err) => {
        if (err) console.error("Failed to delete image file:", err);
      });
    }

    await Message.findByIdAndDelete(messageId);

    // Realtime notify peers to remove message (best-effort)
    try {
      const roomId = getRoomId(
        message.sender?.toString?.() || message.sender,
        message.receiver?.toString?.() || message.receiver
      );
      io.to(roomId).emit("messageDeleted", { _id: messageId });
    } catch (e) {
      console.error("Socket emit (messageDeleted) failed:", e);
    }

    return res.status(200).json({
      success: true,
      message: "Message and image deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting message:", err);
    return res.status(500).json({ error: "Failed to delete message" });
  }
};
