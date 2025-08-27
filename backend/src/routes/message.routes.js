import express from "express";
import { getMessages, createMessage, deleteMessage} from "../controler/message.controler.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import {upload} from "../middlewares/upload.js";

const router = express.Router();

router.get("/:senderId/:receiverId", verifyToken, getMessages); 
router.post(
  "/send-message",
  verifyToken,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "voice", maxCount: 1 },
  ]),
  createMessage
);                  
router.delete("/messages/:messageId", verifyToken, deleteMessage);

export default router;
