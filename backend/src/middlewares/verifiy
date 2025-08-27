import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  try {
    // 1. Get token from multiple possible sources
    const token = 
      req.cookies?.accessToken ||
      req.headers['authorization']?.replace('Bearer ', '') ||
      req.headers['x-access-token'];

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Authorization token required" 
      });
    }

    // 2. Verify secret key existence
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
      throw new Error("ACCESS_TOKEN_SECRET not configured");
    }

    // 3. Verify token
    const decoded = jwt.verify(token, secret);
    
    // 4. Attach user data to request
    req.user = {
      _id: decoded._id,
      role: decoded.role,  // Changed from role_id to role for consistency
      email: decoded.email // Add other needed fields
    };

    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);
    
    // Specific error messages
    let message = "Invalid token";
    if (error.name === "TokenExpiredError") {
      message = "Token expired";
    } else if (error.name === "JsonWebTokenError") {
      message = "Malformed token";
    }

    return res.status(401).json({ 
      success: false,
      message 
    });
  }
};