import express from "express";
import cors from "cors"

import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
   origin: process.env.FRONTEND_URL || "http://localhost:5173", 
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"], // Explicitly allow
}));





app.use(express.json({limit : "16kb"}))
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))
app.use(cookieParser())

app.use("/uploads", express.static("uploads"));

//routes

import userRouter from "./routes/users.routes.js";


app.use("/api", userRouter)

import createPosts from "./routes/post.routes.js";


app.use("/api", createPosts)

import Mesaagefun from "./routes/message.routes.js"
app.use("/api", Mesaagefun)


export {app}
