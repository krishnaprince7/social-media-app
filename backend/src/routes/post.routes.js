import express from "express";
import {upload} from "../middlewares/upload.js";
import { createPost, getPosts, getUserPosts, deletePost, editPost, toggleLike, addComment, getComments, getLikes, getAllUsersWithPosts, getUserProfileWithPosts, getAllUsernames, deleteComment } from "../controler/post.controler.js";
import { verifyToken } from "../middlewares/verifyToken.js";



const router = express.Router();

// POST /api/posts
router.post("/create-post", verifyToken, upload.single("image"), createPost);
router.get("/posts", verifyToken, getPosts);
router.get("/my-posts", verifyToken, getUserPosts);
router.delete("/delete-post/:id", verifyToken, deletePost);
router.put("/edit-post/:id", verifyToken, upload.single("image"), editPost);
router.post("/like/:id", verifyToken, toggleLike);
router.get("/likes/:id", verifyToken, getLikes);

// Comment routes
router.post("/comment/:id", verifyToken, addComment);
router.get("/comments/:id",verifyToken, getComments);
router.delete('/comment/:postId/:commentId', verifyToken, deleteComment);
router.get("/explore", verifyToken, getAllUsersWithPosts);

router.get("/profile/:id", getUserProfileWithPosts);
router.get("/usernames", verifyToken, getAllUsernames);




export default router;
