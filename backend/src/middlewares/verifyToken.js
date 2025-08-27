import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  // 1. Token header se uthao
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = authHeader.split(" ")[1]; // "Bearer TOKEN" se TOKEN nikalna

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded; // decoded payload ko req.user me store karo
    next(); // aage badho
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
