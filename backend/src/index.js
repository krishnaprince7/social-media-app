import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import connectDB from "./controler/db/index.js";
import { app } from "./app.js";
import Message from "./models/message.models.js";
import User from "./models/users.models.js"; // ✅ Add this

dotenv.config({ path: "./.env" });

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Helper: order-independent room id for a 1:1 chat
const getRoomId = (a, b) =>
  [String(a), String(b)].sort((x, y) => (x > y ? 1 : -1)).join("::");

// Map userId -> Set<socketId>
const socketsByUser = new Map();

function addUserSocket(userId, socketId) {
  const id = String(userId);
  if (!socketsByUser.has(id)) socketsByUser.set(id, new Set());
  socketsByUser.get(id).add(socketId);
}

function removeUserSocket(socketId) {
  for (const [uid, set] of socketsByUser) {
    if (set.delete(socketId) && set.size === 0) socketsByUser.delete(uid);
  }
}

function listOnlineUserIds() {
  return Array.from(socketsByUser.keys());
}

io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  // User online
  socket.on("addUser", async (userId) => {
    addUserSocket(userId, socket.id);

    // ✅ Update DB: user is online
    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastSeen: null,
    });

    io.emit("getUsers", listOnlineUserIds());
  });

  // Join/leave conversation rooms
  socket.on("joinRoom", ({ roomId, userId }) => {
    socket.join(roomId);
    if (userId) addUserSocket(userId, socket.id);
  });

  socket.on("leaveRoom", ({ roomId }) => {
    socket.leave(roomId);
  });

  // Send message
  socket.on("sendMessage", async ({ roomId, sender, receiver, text, tempId }) => {
    try {
      const saved = await new Message({ sender, receiver, text, tempId }).save();
      io.to(roomId).emit("message", { ...saved.toObject(), tempId });
    } catch (err) {
      console.error("❌ sendMessage error:", err);
    }
  });

  // Disconnect
  socket.on("disconnect", async () => {
    let disconnectedUserId = null;

    // Find which user had this socket
    for (const [uid, sockets] of socketsByUser.entries()) {
      if (sockets.has(socket.id)) {
        disconnectedUserId = uid;
        break;
      }
    }

    removeUserSocket(socket.id);

    // ✅ If user has no active sockets -> mark offline + set lastSeen
    if (disconnectedUserId && !socketsByUser.has(disconnectedUserId)) {
      await User.findByIdAndUpdate(disconnectedUserId, {
        isOnline: false,
        lastSeen: new Date(),
      });
    }

    io.emit("getUsers", listOnlineUserIds());
    console.log("❌ User disconnected:", socket.id);
  });
});

connectDB()
  .then(() => {
    const PORT = process.env.PORT || 8000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("❌ Mongo DB Connection Failed!!", err);
  });

export { io, getRoomId };
