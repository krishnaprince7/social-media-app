import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { FiSettings, FiGrid, FiBookmark, FiX, FiHeart, FiMessageSquare, FiSend } from "react-icons/fi";
import { FaRegUserCircle } from "react-icons/fa";

const MyProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";
  const token = localStorage.getItem("access_token");
  const loggedInUserId = localStorage.getItem("userId");

  const api = axios.create({
    baseURL: BASE_URL,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    withCredentials: true,
  });

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [selectedPost, setSelectedPost] = useState(null);
  const [commentText, setCommentText] = useState("");

  const getFullImageUrl = (url) => {
    if (!url) return "/default-avatar.jpg";
    return url.startsWith("http")
      ? url
      : `${BASE_URL.replace("/api", "")}${url}`;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get(`/profile/${id}`);
        if (res.data.success) {
          setProfile(res.data.user);
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  const handleUserClick = (userId) => {
    if (userId) navigate(`/profile/${userId}`);
  };

  const handleMessageClick = (receiverId) => {
    if (receiverId && loggedInUserId) {
      navigate(`/messages/${loggedInUserId}/${receiverId}`);
    } else {
      console.warn("Missing IDs for navigation");
    }
  };

  const handlePostClick = (post) => {
    setSelectedPost(post);
  };

  const closePostModal = () => {
    setSelectedPost(null);
    setCommentText("");
  };

  const handleLikePost = async (postId) => {
    try {
      const res = await api.post(`/posts/${postId}/like`);
      if (res.data.success) {
        // Update the post in the profile state
        const updatedPosts = profile.posts.map(post => {
          if (post._id === postId) {
            return { 
              ...post, 
              likeCount: res.data.liked ? post.likeCount + 1 : post.likeCount - 1
            };
          }
          return post;
        });
        
        setProfile({ ...profile, posts: updatedPosts });
        
        // Also update the selected post if it's the one being liked
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost({ 
            ...selectedPost, 
            likeCount: res.data.liked ? selectedPost.likeCount + 1 : selectedPost.likeCount - 1
          });
        }
      }
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  const handleAddComment = async (postId) => {
    if (!commentText.trim()) return;
    
    try {
      const res = await api.post(`/posts/${postId}/comments`, {
        text: commentText
      });
      
      if (res.data.success) {
        // Update the post in the profile state
        const updatedPosts = profile.posts.map(post => {
          if (post._id === postId) {
            return { 
              ...post, 
              commentCount: post.commentCount + 1,
              comments: [...post.comments, res.data.comment]
            };
          }
          return post;
        });
        
        setProfile({ ...profile, posts: updatedPosts });
        
        // Also update the selected post if it's the one being commented on
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost({ 
            ...selectedPost, 
            commentCount: selectedPost.commentCount + 1,
            comments: [...selectedPost.comments, res.data.comment]
          });
        }
        
        setCommentText("");
      }
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  // Skeleton loader component
  const ProfileSkeleton = () => (
    <div className="bg-gray-900 min-h-screen text-white">
      {/* Profile Header Skeleton */}
      <div className="max-w-screen-md mx-auto py-6 px-4">
        <div className="flex items-center space-x-6 animate-pulse">
          <div className="w-20 h-20 rounded-full bg-gray-800"></div>
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-800 rounded"></div>
            <div className="h-3 w-24 bg-gray-800 rounded"></div>
            <div className="h-3 w-20 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>

      {/* Stats Skeleton */}
      <div className="max-w-screen-md mx-auto px-4 py-4 border-t border-b border-gray-800">
        <div className="flex justify-between animate-pulse">
          {[1, 2, 3].map((item) => (
            <div key={item} className="text-center">
              <div className="h-4 w-6 bg-gray-800 rounded mx-auto"></div>
              <div className="h-3 w-16 bg-gray-800 rounded mt-1 mx-auto"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="max-w-screen-md mx-auto flex border-t border-gray-800 animate-pulse">
        <div className="flex-1 py-3 flex justify-center">
          <div className="h-5 w-5 bg-gray-800 rounded"></div>
        </div>
        <div className="flex-1 py-3 flex justify-center">
          <div className="h-5 w-5 bg-gray-800 rounded"></div>
        </div>
      </div>

      {/* Posts Grid Skeleton */}
      <div className="max-w-screen-md mx-auto grid grid-cols-3 gap-2 px-4 py-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="aspect-square bg-gray-800"></div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900 text-white">
        <p>Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      {/* Profile Header */}
      <div className="max-w-screen-md mx-auto py-6 px-4">
        <div className="flex items-center space-x-6">
          <div className="w-20 h-20 rounded-full overflow-hidden border border-gray-600">
            <img
              src={getFullImageUrl(profile.profilePicture)}
              alt={profile.username}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/default-avatar.jpg";
              }}
            />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{profile.username}</h2>
              <button 
                className="bg-green-400 rounded px-4 py-2"
                onClick={() => handleMessageClick(id)}
              >
                <span className="font-semibold">Message</span>
              </button>
            </div>
            <p className="text-gray-400 mt-1">{profile.bio || "No bio yet"}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-screen-md mx-auto px-4 py-4 border-t border-b border-gray-800">
        <div className="flex justify-between text-center">
          <div className="flex-1">
            <p className="font-semibold">{profile.postCount || 0}</p>
            <p className="text-gray-400 text-sm">Posts</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-screen-md mx-auto flex border-t border-gray-800">
        <button
          className={`flex-1 py-3 flex justify-center ${
            activeTab === "posts" ? "text-white border-t border-white" : "text-gray-400"
          }`}
          onClick={() => setActiveTab("posts")}
        >
          <FiGrid className="text-xl" />
        </button>
      </div>

      {/* Posts Grid */}
      <div className="max-w-screen-md mx-auto grid grid-cols-3 gap-2 px-4 py-4">
        {profile.posts?.length > 0 ? (
          profile.posts.map((post) => (
            <div
              key={post._id}
              className="aspect-square bg-gray-800 relative group cursor-pointer"
              onClick={() => handlePostClick(post)}
            >
              <img
                src={getFullImageUrl(post.imageUrl)}
                alt={post.caption}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                <div className="flex items-center text-white space-x-4">
                  <span className="font-semibold">
                    <span className="mr-1">❤️</span> {post.likeCount || 0}
                  </span>
                  <span className="font-semibold">
                    <span className="mr-1">💬</span> {post.commentCount || 0}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 py-16 text-center text-gray-400">
            <p className="text-xl">No posts yet</p>
            <button 
              className="mt-4 px-4 py-2 bg-blue-500 rounded text-white"
              onClick={() => navigate('/create-post')}
            >
              Create your first post
            </button>
          </div>
        )}
      </div>

      {/* Post Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
            {/* Image Section */}
            <div className="md:w-1/2 bg-black flex items-center justify-center">
              <img
                src={getFullImageUrl(selectedPost.imageUrl)}
                alt={selectedPost.caption}
                className="w-full h-full object-contain max-h-[70vh]"
              />
            </div>
            
            {/* Content Section */}
            <div className="md:w-1/2 flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <img
                    src={getFullImageUrl(profile.profilePicture)}
                    alt={profile.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <span className="font-semibold">{profile.username}</span>
                </div>
                <button onClick={closePostModal} className="text-white">
                  <FiX size={24} />
                </button>
              </div>
              
              {/* Comments */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Caption */}
                <div className="flex space-x-3">
                  <img
                    src={getFullImageUrl(profile.profilePicture)}
                    alt={profile.username}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div>
                    <p>
                      <span className="font-semibold mr-2">{profile.username}</span>
                      {selectedPost.caption}
                    </p>
                  </div>
                </div>
                
                {/* Comments List */}
                {selectedPost.comments?.map((comment) => (
                  <div key={comment._id} className="flex space-x-3">
                    <img
                      src={getFullImageUrl(comment.user.profilePicture)}
                      alt={comment.user.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                      <p>
                        <span className="font-semibold mr-2">{comment.user.username}</span>
                        {comment.text}
                      </p>
                      <p className="text-gray-400 text-xs">{new Date(comment.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Actions */}
              <div className="p-4 border-t border-gray-800">
                <div className="flex justify-between mb-2">
                  <div className="flex space-x-4">
                    <button onClick={() => handleLikePost(selectedPost._id)}>
                      <FiHeart size={24} />
                    </button>
                    <button>
                      <FiMessageSquare size={24} />
                    </button>
                    <button>
                      <FiSend size={24} />
                    </button>
                  </div>
                </div>
                
                <p className="font-semibold">{selectedPost.likeCount} likes</p>
                <p className="text-gray-400 text-sm">{new Date(selectedPost.createdAt).toLocaleDateString()}</p>
                
                {/* Add Comment */}
                <div className="flex mt-3 border-t border-gray-800 pt-3">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    className="flex-1 bg-transparent outline-none"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                  />
                  <button 
                    className="text-blue-500 font-semibold disabled:text-gray-500"
                    onClick={() => handleAddComment(selectedPost._id)}
                    disabled={!commentText.trim()}
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyProfile;