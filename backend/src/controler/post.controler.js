import Post from "../models/post.models.js";
import User from "../models/users.models.js";
import { fileURLToPath } from 'url'; // <-- Add this import
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import asynchandler from "../utils/asynchandler.js";


// Now these will work correctly
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// controllers/post.controller.js
export const createPost = async (req, res) => {
  try {
    const { caption, userId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image is required",
      });
    }

    // Construct full URL for the image
    const imageUrl = `/uploads/${req.file.filename}`;

    const newPost = await Post.create({
      caption,
      imageUrl,
      author: userId,
    });

    await User.findByIdAndUpdate(userId, {
      $push: { posts: newPost._id },
    });

    res.status(201).json({
      success: true,
      post: {
        ...newPost.toObject(),
        imageUrl, // Include the full URL in response
      },
    });
  } catch (error) {
    console.error("Post creation error:", error);
    
    // Handle multer errors specifically
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const getUserPosts = async (req, res) => {
  try {
    const userId = req.user.id; // get user ID from token

    const posts = await Post.find({ author: userId })
      .select("caption imageUrl author createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      posts,
    });
  } catch (error) {
    console.error("Fetch user posts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


export const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .select("caption imageUrl author createdAt") // only needed fields
      .sort({ createdAt: -1 }); // latest first

    res.status(200).json({
      success: true,
      posts,
    });
  } catch (error) {
    console.error("Fetch posts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findById(id);

    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.imageUrl) {
      const filename = post.imageUrl.split('/').pop();
      const imagePath = path.join(__dirname, '..', '..', 'uploads', filename);


      if (fs.existsSync(imagePath)) {
        await fs.promises.unlink(imagePath);
      
      } else {
        console.warn("Image not found:", filename);
      }
    }

    await Post.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Post deleted" });

  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const editPost = async (req, res) => {
  try {
    const { id } = req.params; // post id from URL
    const { caption } = req.body; // new caption

    // Find post
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Update caption if provided
    if (caption) {
      post.caption = caption;
    }

    // If new image is uploaded
    if (req.file) {
      // delete old image if exists
      if (post.imageUrl) {
        const oldImagePath = path.join("uploads", path.basename(post.imageUrl));
        fs.unlink(oldImagePath, (err) => {
          if (err) console.error("Error deleting old image:", err);
        });
      }

      // save new image
      post.imageUrl = `/uploads/${req.file.filename}`;
    }

    // save updated post
    await post.save();

    res.status(200).json({
      success: true,
      message: "Post updated successfully",
      post,
    });
  } catch (error) {
    console.error("Edit post error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};







export const toggleLike = async (req, res) => {
  try {
    // Destructure 'id' from req.params (instead of postId)
    const { id } = req.params;
    const userId = req.user.id; // Using 'id' from your JWT payload

    console.log("Processing like for post:", id);

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }

    // Find post
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    // Check if already liked
    const isLiked = post.likes.some(likeId => 
      likeId.toString() === userId.toString()
    );

    // Update like status
    const updateOperation = isLiked
      ? { $pull: { likes: userId } }
      : { $addToSet: { likes: userId } };

    const updatedPost = await Post.findByIdAndUpdate(
      id, // Using id here
      updateOperation,
      { new: true }
    ).populate([
      { path: 'likes', select: 'username profilePicture' },
      { path: 'author', select: 'username profilePicture' }
    ]);

    return res.status(200).json({
      success: true,
      message: isLiked ? "Post unliked" : "Post liked",
      data: {
        likes: updatedPost.likes,
        likeCount: updatedPost.likes.length,
        isLiked: !isLiked
      }
    });

  } catch (error) {
    console.error("Like error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const getLikes = async (req, res) => {
  try {
    const { id } = req.params;  // postId
    const userId = req.user.id; // Logged-in user

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID format"
      });
    }

    // Find post with likes populated
    const post = await Post.findById(id)
      .populate("likes", "username profilePicture");

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Check if current user has liked
    const isLiked = post.likes.some(
      likeUser => likeUser._id.toString() === userId.toString()
    );

    return res.status(200).json({
      success: true,
      message: "Likes fetched successfully",
      data: {
        likes: post.likes,
        likeCount: post.likes.length,
        isLiked
      }
    });

  } catch (error) {
    console.error("Get likes error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// Add Comment
export const addComment = async (req, res) => {
  try {
    const { id } = req.params; // Changed from postId to id
    const { text } = req.body;
    const userId = req.user.id; // Using id instead of _id to match your JWT

    console.log("Adding comment to post:", id);

    // Validate input
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid post ID format" 
      });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "Comment text is required",
        field: "text"
      });
    }

    if (text.length > 500) {
      return res.status(400).json({ 
        success: false,
        message: "Comment cannot exceed 500 characters",
        field: "text"
      });
    }

    const post = await Post.findById(id); // Using id here
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    const newComment = {
      user: userId,
      text: text.trim(),
      createdAt: new Date() // Added timestamp
    };

    // Using atomic update instead of save()
    const updatedPost = await Post.findByIdAndUpdate(
      id,
      { $push: { comments: newComment } },
      { new: true }
    ).populate({
      path: 'comments.user',
      select: 'username profilePicture'
    });

    // Get the last comment (the one we just added)
    const addedComment = updatedPost.comments[updatedPost.comments.length - 1];

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: addedComment
    });
  } catch (error) {
    console.error("Comment error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get Comments
export const getComments = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate postId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid post ID format" 
      });
    }

    const post = await Post.findById(id)
      .select('comments')
      .populate({
        path: 'comments.user',
        select: 'username profilePicture'
      });

    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const totalComments = post.comments.length;

    const paginatedComments = post.comments
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(startIndex, endIndex);

    // Pagination result
    const pagination = {};
    if (endIndex < totalComments) {
      pagination.next = {
        page: parseInt(page) + 1,
        limit: parseInt(limit)
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: parseInt(page) - 1,
        limit: parseInt(limit)
      };
    }

    res.status(200).json({
      success: true,
      count: paginatedComments.length,
      pagination,
      data: paginatedComments
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params; // This should match your route parameters
    const userId = req.user.id;

    console.log("Deleting comment:", commentId, "from post:", postId, "by user:", userId);

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid post ID format" 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid comment ID format" 
      });
    }

    // Find the post first
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ 
        success: false, 
        message: "Post not found" 
      });
    }

    // Find the comment
    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        message: "Comment not found" 
      });
    }

    // Check if user owns the comment
    if (comment.user.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "You don't have permission to delete this comment" 
      });
    }

    // Remove the comment
    comment.deleteOne();
    
    // Save the post
    await post.save();

    return res.status(200).json({
      success: true,
      message: "Comment deleted successfully"
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } 
};


export const getAllUsersWithPosts = asynchandler(async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const users = await User.aggregate([
      {
        $lookup: {
          from: "posts",
          let: { userId: "$_id", username: "$username", userProfilePic: "$profilePicture" },
          pipeline: [
            { $match: { $expr: { $eq: ["$author", "$$userId"] } } },
            { $sort: { createdAt: -1 } },
            {
              $lookup: {
                from: "users",
                localField: "comments.user",
                foreignField: "_id",
                pipeline: [
                  { $project: { username: 1, profilePicture: 1 } }
                ],
                as: "commentUsers"
              }
            },
            {
              $addFields: {
                authorInfo: {
                  _id: "$$userId",
                  username: "$$username",
                  profilePicture: "$$userProfilePic"
                },
                comments: {
                  $map: {
                    input: "$comments",
                    as: "comment",
                    in: {
                      $mergeObjects: [
                        "$$comment",
                        {
                          user: {
                            $arrayElemAt: [
                              "$commentUsers",
                              { $indexOfArray: ["$commentUsers._id", "$$comment.user"] }
                            ]
                          }
                        }
                      ]
                    }
                  }
                }
              }
            },
            { 
              $project: { 
                _id: 1, // ADD THIS LINE - include post ID
                imageUrl: 1,
                caption: 1,
                likes: { $size: "$likes" },
                comments: { $slice: ["$comments", 3] },
                authorInfo: 1,
                createdAt: 1
              } 
            }
          ],
          as: "posts"
        }
      },
      {
        $project: {
          username: 1,
          profilePicture: 1,
          posts: 1
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    ]);

    const totalUsers = await User.countDocuments();

    const pagination = {};
    if (page * limit < totalUsers) {
      pagination.next = {
        page: parseInt(page) + 1,
        limit: parseInt(limit)
      };
    }
    if ((page - 1) * limit > 0) {
      pagination.prev = {
        page: parseInt(page) - 1,
        limit: parseInt(limit)
      };
    }

    res.status(200).json({
      success: true,
      count: users.length,
      totalUsers,
      pagination,
      users: users.map(user => ({
        username: user.username,
        profilePicture: user.profilePicture || "/default-avatar.jpg",
        posts: user.posts.map(post => ({
          _id: post._id, // ADD THIS LINE - include post ID in response
          imageUrl: post.imageUrl,
          caption: post.caption,
          likes: post.likes,
          authorInfo: {
            _id: post.authorInfo._id,
            username: post.authorInfo.username,
            profilePicture: post.authorInfo.profilePicture || "/default-avatar.jpg"
          },
          comments: post.comments.map(comment => ({
            text: comment.text,
            user: {
              username: comment.user.username,
              profilePicture: comment.user.profilePicture
            },
            createdAt: comment.createdAt
          })),
          createdAt: post.createdAt
        }))
      }))
    });
  } catch (error) {
    console.error("Error fetching users with posts and comments:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});


export const getUserProfileWithPosts = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    // Find user
    const user = await User.findById(id).select("_id username profilePicture bio");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Find user's posts with populated comments (including user details for each comment)
    const posts = await Post.find({ author: id })
      .select("_id imageUrl caption createdAt likes comments")
      .sort({ createdAt: -1 })
      .populate({
        path: 'comments.user', // Populate user details in comments
        select: 'username profilePicture' // Only fetch necessary user fields
      });

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture || "/default-avatar.jpg",
        bio: user.bio || "",
        postCount: posts.length,
        posts: posts.map(post => ({
          _id: post._id,
          imageUrl: post.imageUrl,
          caption: post.caption,
          createdAt: post.createdAt,
          likeCount: Array.isArray(post.likes) ? post.likes.length : 0, // Likes count
          commentCount: Array.isArray(post.comments) ? post.comments.length : 0, // Comments count
          comments: post.comments.map(comment => ({
            _id: comment._id,
            text: comment.text,
            createdAt: comment.createdAt,
            user: {
              _id: comment.user._id,
              username: comment.user.username,
              profilePicture: comment.user.profilePicture || "/default-avatar.jpg"
            }
          }))
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


export const getAllUsernames = async (req, res) => {
  try {
    // Fetch only _id, username and profilePicture from User collection
    const users = await User.find({}, "_id username profilePicture").lean();

    res.status(200).json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture || null, // fallback if no picture
      }))
    });
  } catch (error) {
    console.error("Error fetching usernames:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};
