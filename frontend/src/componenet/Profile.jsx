import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  FiMenu,
  FiX,
  FiMessageCircle,
  FiLock,
  FiLogOut,
  FiPlus,
  FiImage,
  FiEdit,
  FiTrash2,
  FiEdit3, // Added for edit profile icon
} from "react-icons/fi";
import { AiOutlineHeart, AiFillHeart } from "react-icons/ai";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";
import { useNavigate } from "react-router-dom"; // Added for navigation

const Profile = () => {
  const BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";
  const API_HOST = BASE_URL.replace(/\/api\/?$/, "");
  const token = localStorage.getItem("access_token");
  const navigate = useNavigate(); // Added for navigation

  // Dark mode: force ON
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("posts");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const fileInputRef = useRef(null);
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [editingPost, setEditingPost] = useState(null);
  const [editCaption, setEditCaption] = useState("");
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  // Likes modal state
  const [likesData, setLikesData] = useState({
    likes: [],
    likeCount: 0,
    isLiked: false,
  });
  const [showLikesModal, setShowLikesModal] = useState(false);

  // Crop state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);

  // Like loading
  const [likeLoading, setLikeLoading] = useState(false);

  // Change Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwdErrors, setPwdErrors] = useState({});
  const [pwdLoading, setPwdLoading] = useState(false);

  // Logout loading (optional)
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Toast for success message after password change
  const [toast, setToast] = useState({ show: false, message: "" });
  const triggerToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  };

  // ADDED: Edit Profile function
  const handleEditProfile = () => {
    setIsSidebarOpen(false); // Close sidebar if open
    navigate('/profile-bio'); // Navigate to profile-bio page
  };

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(URL.createObjectURL(blob));
      }, "image/jpeg");
    });
  };

  const api = axios.create({
    baseURL: BASE_URL,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    withCredentials: true,
  });

  const apiFormData = axios.create({
    baseURL: BASE_URL,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    withCredentials: true,
  });

  const getFullImageUrl = (url) => {
    if (!url) return "";
    return url.startsWith("http")
      ? url
      : `${API_HOST}${url.startsWith("/") ? url : `/${url}`}`;
  };

  const fetchProfile = async () => {
    try {
      const res = await api.get("/current-user");
      if (res.data.success) {
        const processedUser = {
          ...res.data.user,
          profilePicture: getFullImageUrl(res.data.user.profilePicture),
        };
        setUser(processedUser);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      setError("Failed to load profile");
    }
  };

  const fetchUserPosts = async () => {
    try {
      const res = await api.get("/my-posts");
      if (res.data.success) {
        const processedPosts = res.data.posts.map((post) => ({
          ...post,
          imageUrl: getFullImageUrl(post.imageUrl),
          isLiked: post.isLiked ?? false,
          likeCount:
            typeof post.likeCount === "number"
              ? post.likeCount
              : post.likes
              ? post.likes.length
              : 0,
          likes: post.likes ?? [],
          // take server-provided count if present, otherwise derive
          commentCount:
            typeof post.commentCount === "number"
              ? post.commentCount
              : typeof post.commentsCount === "number"
              ? post.commentsCount
              : Array.isArray(post.comments)
              ? post.comments.length
              : 0,
        }));
        setUserPosts(processedPosts);
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
      setError("Failed to load posts");
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
  }, []);

  // Keep counts in sync when a post is selected
  useEffect(() => {
    if (!selectedPost) {
      setComments([]);
      setLikesData({ likes: [], likeCount: 0, isLiked: false });
      return;
    }

    const postId = selectedPost._id;

    const run = async () => {
      try {
        const [likesRes, commentsRes] = await Promise.all([
          api.get(`/likes/${postId}`),
          api.get(`/comments/${postId}`),
        ]);

        if (likesRes.data?.success) {
          const { likeCount, isLiked, likes } = likesRes.data.data;
          setLikesData({ likeCount, isLiked, likes });

          // sync likeCount back to grid
          setUserPosts((prev) =>
            prev.map((p) =>
              p._id === postId ? { ...p, likeCount, isLiked } : p
            )
          );
          setSelectedPost((prev) =>
            prev ? { ...prev, likeCount, isLiked } : prev
          );
        }

        if (commentsRes.data?.success) {
          const arr = commentsRes.data.data;
          setComments(arr);

          // sync commentCount back to grid
          setUserPosts((prev) =>
            prev.map((p) =>
              p._id === postId ? { ...p, commentCount: arr.length } : p
            )
          );
          setSelectedPost((prev) =>
            prev ? { ...prev, commentCount: arr.length } : prev
          );
        }
      } catch (e) {
        // leave existing state if fetch fails
      }
    };

    run();
  }, [selectedPost]);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedPost) return;
    setCommentLoading(true);
    const postId = selectedPost._id;

    try {
      const res = await api.post(`/comment/${postId}`, { text: commentText });
      if (res.data.success) {
        const newComment = res.data.data;

        // update modal list
        setComments((prev) => [newComment, ...prev]);
        setCommentText("");
        // optimistic bump in counts
        setSelectedPost((prev) =>
          prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : prev
        );
        setUserPosts((prev) =>
          prev.map((p) =>
            p._id === postId
              ? { ...p, commentCount: (p.commentCount || 0) + 1 }
              : p
          )
        );
      }
    } catch (err) {
      setError("Failed to post comment");
    } finally {
      setCommentLoading(false);
    }
  };

  // UPDATED: Logout uses POST /logout, then clears and redirects
  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      await api.post("/logout"); // POST request
    } catch (e) {
      // proceed even if server errors
    } finally {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
  };

  const handleFileChange = (e) => {
    // Safely pick first file
    const file = e.target?.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setError("Only JPEG, PNG, or GIF images are allowed");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setShowCropModal(true);
  };

  const onCropComplete = (_croppedArea, pixels) => setCroppedAreaPixels(pixels);

  const handleCropComplete = async () => {
    try {
      const croppedImage = await getCroppedImg(previewUrl, croppedAreaPixels);
      setPreviewUrl(croppedImage);
      setShowCropModal(false);
    } catch (e) {
      console.error("Error cropping image", e);
      setError("Failed to crop image");
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    setError(null);
    if (!selectedFile) {
      setError("Please select an image");
      return;
    }
    setIsPosting(true);
    try {
      let fileToUpload = selectedFile;
      if (previewUrl.startsWith("data:")) {
        const blob = await fetch(previewUrl).then((r) => r.blob());
        fileToUpload = new File([blob], selectedFile.name, {
          type: selectedFile.type,
        });
      }
      const formData = new FormData();
      formData.append("image", fileToUpload);
      formData.append("caption", caption);
      formData.append("userId", user._id);

      const response = await apiFormData.post("/create-post", formData);
      if (response.data.success) {
        const newPost = {
          ...response.data.post,
          imageUrl: getFullImageUrl(response.data.post.imageUrl),
          isLiked: false,
          likeCount: 0,
          likes: [],
          commentCount: 0,
        };
        setUserPosts((prev) => [newPost, ...prev]);
        setCaption("");
        setSelectedFile(null);
        setPreviewUrl("");
        setShowCreatePostModal(false);
      }
    } catch (e) {
      console.error("Error creating post:", e);
      setError(e.response?.data?.message || "Failed to create post");
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      const res = await api.delete(`/delete-post/${postId}`);
      if (res.data.success) {
        setUserPosts((prev) => prev.filter((p) => p._id !== postId));
        setSelectedPost(null);
      }
    } catch {
      setError("Failed to delete post");
    }
  };

  const handleEditPost = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/edit-post/${editingPost._id}`, {
        caption: editCaption,
      });
      if (res.data.success) {
        setUserPosts((prev) =>
          prev.map((post) =>
            post._id === editingPost._id
              ? { ...post, caption: editCaption }
              : post
          )
        );
        setEditingPost(null);
        setEditCaption("");
        setSelectedPost(null);
      }
    } catch {
      setError("Failed to edit post");
    }
  };

  const handleLikeToggle = async (postId) => {
    setLikeLoading(true);
    try {
      const res = await api.post(`/like/${postId}`);
      if (res.data.success) {
        const { likes, likeCount, isLiked } = res.data.data;
        // grid update
        setUserPosts((prevPosts) =>
          prevPosts.map((p) =>
            p._id === postId ? { ...p, likes, likeCount, isLiked } : p
          )
        );

        // modal update (if open)
        if (selectedPost && selectedPost._id === postId) {
          setSelectedPost((prev) =>
            prev ? { ...prev, likes, likeCount, isLiked } : prev
          );
          setLikesData((prev) => ({ ...prev, likeCount, isLiked }));
        }
      }
    } catch {
      setError("Failed to like/unlike post");
    } finally {
      setLikeLoading(false);
    }
  };

  // OPEN Change Password modal: also close sidebar (mobile)
  const openPasswordModal = () => {
    setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    setPwdErrors({});
    setError(null);
    setShowPasswordModal(true);
    setIsSidebarOpen(false); // close the sidebar when opening modal
  };

  // SUBMIT Change Password
  // Requirement: stay on profile page, show toast "Password changed",
  // clear inputs, close modal. No redirect.
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPwdErrors({});
    setError(null);

    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdErrors({ confirmPassword: "Passwords do not match" });
      return;
    }

    setPwdLoading(true);
    try {
      const res = await api.put("/update-password", {
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword,
        confirmPassword: pwdForm.confirmPassword,
      });

      if (res.data?.success) {
        // Success UX per request
        triggerToast("Password changed");
        setPwdForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
        setPwdErrors({});
        setShowPasswordModal(false);
        return;
      }

      if (res.data?.errors) {
        setPwdErrors(res.data.errors);
      } else {
        setError(res.data?.message || "Failed to update password");
      }
    } catch (err) {
      const apiErrors = err?.response?.data?.errors;
      if (apiErrors) {
        setPwdErrors(apiErrors);
      } else {
        setError(err?.response?.data?.message || "Failed to update password");
      }
    } finally {
      setPwdLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center min-h-screen bg-[#0b0f16] text-white">
        <div className="w-full max-w-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="h-6 w-28 bg-gray-800 animate-pulse rounded" />
            <div className="h-8 w-32 bg-gray-800 animate-pulse rounded" />
          </div>
          <hr className="border-gray-800 mb-6" />
          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-full bg-gray-800 animate-pulse" />
            <div className="flex-1 space-y-3">
              <div className="h-5 w-40 bg-gray-800 animate-pulse rounded" />
              <div className="flex gap-6">
                <div className="h-4 w-12 bg-gray-800 animate-pulse rounded" />
                <div className="h-4 w-16 bg-gray-800 animate-pulse rounded" />
                <div className="h-4 w-20 bg-gray-800 animate-pulse rounded" />
              </div>
              <div className="h-4 w-48 bg-gray-800 animate-pulse rounded" />
            </div>
          </div>
          <hr className="border-gray-800 my-8" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-800 animate-pulse rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0b0f16] text-white">
      {/* Create Post Modal */}
      {showCreatePostModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#101826] rounded-2xl w-full max-w-md ring-1 ring-white/10 shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold">Create New Post</h2>
              <button
                onClick={() => {
                  setShowCreatePostModal(false);
                  setCaption("");
                  setSelectedFile(null);
                  setPreviewUrl("");
                  setError(null);
                }}
                className="p-2 rounded hover:bg-white/10"
              >
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePost}>
              <div className="p-4 space-y-4">
                {error && (
                  <div className="p-2 bg-red-500/10 text-red-200 rounded border border-red-500/30 text-sm">
                    {error}
                  </div>
                )}

                {!previewUrl ? (
                  <div
                    className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-white/20 transition"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FiImage className="mx-auto text-white/40" size={48} />
                    <p className="mt-2 text-sm text-white/60">
                      Select an image to upload
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                      JPEG, PNG, or GIF (max 5MB)
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/jpeg, image/png, image/gif"
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-64 object-contain rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl("");
                      }}
                      className="absolute top-2 right-2 bg-black/50 p-1 rounded-full"
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="caption"
                    className="block text-sm font-medium mb-1"
                  >
                    Caption
                  </label>
                  <textarea
                    id="caption"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0f1522] border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    rows={3}
                    placeholder="Write a caption..."
                    maxLength={2200}
                  />
                </div>
              </div>

              <div className="p-4 border-t border-white/10 flex justify-end">
                <button
                  type="submit"
                  disabled={!selectedFile || isPosting}
                  className={`px-4 py-2 rounded-lg text-white transition ${
                    !selectedFile || isPosting
                      ? "bg-blue-500/40 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-500"
                  }`}
                >
                  {isPosting ? "Posting..." : "Share Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Crop Image Modal */}
      {showCropModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md mb-4">
            <h2 className="text-xl font-semibold mb-3">Crop Your Image</h2>
            <div className="relative w-full h-96 bg-black rounded-lg overflow-hidden ring-1 ring-white/10">
              <Cropper
                image={previewUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                cropShape="rect"
                showGrid={false}
              />
            </div>
            <div className="mt-4">
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowCropModal(false);
                setSelectedFile(null);
                setPreviewUrl("");
              }}
              className="px-4 py-2 bg-white/10 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleCropComplete}
              className="px-4 py-2 bg-blue-600 rounded-lg"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Likes Modal */}
      {showLikesModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#101826] rounded-2xl w-full max-w-sm p-4 ring-1 ring-white/10">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">Likes</h2>
              <button
                onClick={() => setShowLikesModal(false)}
                className="p-2 rounded hover:bg-white/10"
              >
                <FiX size={18} />
              </button>
            </div>
            <div className="text-sm text-white/70 mb-2">
              {likesData.likeCount} {likesData.likeCount === 1 ? "Like" : "Likes"}
            </div>
            {likesData.likes.length === 0 ? (
              <div className="text-white/50 text-sm text-center py-2">
                No likes yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {likesData.likes.map((u) => (
                  <li key={u._id} className="flex items-center gap-2">
                    <img
                      src={getFullImageUrl(u.profilePicture)}
                      alt={u.username}
                      className="w-8 h-8 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/default-profile.png";
                      }}
                    />
                    <span className="font-semibold text-xs">{u.username}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#101826] rounded-2xl w-full max-w-sm p-4 ring-1 ring-white/10">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold">Change Password</h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-2 rounded hover:bg-white/10"
                aria-label="Close"
              >
                <FiX size={18} />
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2 bg-red-500/10 text-red-200 rounded border border-red-500/30 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handlePasswordUpdate} className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Old password</label>
                <input
                  type="password"
                  value={pwdForm.oldPassword}
                  onChange={(e) =>
                    setPwdForm((prev) => ({ ...prev, oldPassword: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0f1522] border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="Enter old password"
                  autoComplete="current-password"
                />
                {pwdErrors.oldPassword && (
                  <p className="text-xs text-red-400 mt-1">
                    {pwdErrors.oldPassword}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm mb-1">New password</label>
                <input
                  type="password"
                  value={pwdForm.newPassword}
                  onChange={(e) =>
                    setPwdForm((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0f1522] border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                />
                {pwdErrors.newPassword && (
                  <p className="text-xs text-red-400 mt-1">
                    {pwdErrors.newPassword}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm mb-1">Confirm password</label>
                <input
                  type="password"
                  value={pwdForm.confirmPassword}
                  onChange={(e) =>
                    setPwdForm((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0f1522] border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
                {pwdErrors.confirmPassword && (
                  <p className="text-xs text-red-400 mt-1">
                    {pwdErrors.confirmPassword}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 bg-white/10 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-4 py-2 bg-blue-600 rounded-lg disabled:bg-blue-600/40"
                >
                  {pwdLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", ease: "easeInOut" }}
              className="fixed inset-y-0 left-0 w-72 bg-[#0f1522] ring-1 ring-white/10 shadow-2xl z-50"
            >
              <div className="flex flex-col h-full p-4">
                {/* Sidebar Header */}
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold">Menu</h2>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 rounded-full hover:bg-white/10"
                  >
                    <FiX size={20} />
                  </button>
                </div>

                {/* User quick card */}
                <div className="flex items-center mb-6 p-3 rounded-xl bg-white/5 ring-1 ring-white/10">
                  <div className="w-12 h-12 rounded-full overflow-hidden mr-3 ring-2 ring-blue-500/40">
                    <img
                      src={user.profilePicture}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/default-profile.png";
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{user.username}</h3>
                    <p className="text-xs text-white/50 truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>

                {/* UPDATED: Now three actions */}
                <nav className="flex-1">
                  <ul className="space-y-2">
                    <li>
                      <button
                        className="flex items-center w-full p-3 rounded-lg hover:bg-white/10"
                        onClick={handleEditProfile}
                      >
                        <FiEdit3 className="mr-3" />
                        Edit Profile
                      </button>
                    </li>
                    <li>
                      <button
                        className="flex items-center w-full p-3 rounded-lg hover:bg-white/10"
                        onClick={openPasswordModal}
                      >
                        <FiLock className="mr-3" />
                        Change Password
                      </button>
                    </li>
                    <li>
                      <button
                        className="flex items-center w-full p-3 rounded-lg hover:bg-white/10 text-red-400 disabled:opacity-60"
                        onClick={handleLogout}
                        disabled={logoutLoading}
                      >
                        <FiLogOut className="mr-3" />
                        {logoutLoading ? "Logging out..." : "Logout"}
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-[#0b0f16]/60 bg-[#0b0f16]/80 border-b border-white/10">
          <div className="flex justify-between items-center px-4 py-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-white/10"
              aria-label="Open menu"
            >
              <FiMenu size={22} />
            </button>
            <h1 className="text-lg font-semibold">Profile</h1>
            {/* UPDATED: Added Edit Profile button in header */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleEditProfile}
                className="px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 shadow-md"
                title="Edit Profile"
              >
                <div className="flex items-center gap-2">
                  <FiEdit3 size={18} className="stroke-2" />
                  <span className="text-sm hidden sm:inline">Edit</span>
                </div>
              </button>
              <button
                onClick={() => setShowCreatePostModal(true)}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20"
              >
                <div className="flex items-center gap-2">
                  <FiPlus size={18} className="stroke-2" />
                  <span className="text-sm">Create Post</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="p-4">
          <div className="flex items-center">
            <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-blue-500/40">
              <img
                src={user.profilePicture}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/default-profile.png";
                }}
              />
            </div>
            <div className="ml-6 flex-1">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-semibold">{user.username}</h1>
                <button
                  onClick={handleEditProfile}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-sm flex items-center gap-2"
                >
                  <FiEdit3 size={14} />
                  Edit Profile
                </button>
              </div>
              <div className="flex gap-8 mt-4">
                <div className="text-center">
                  <span className="font-bold block">{userPosts.length}</span>
                  <span className="text-sm text-white/70">Posts</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h2 className="font-semibold">{user.username}</h2>
            <p className="text-sm mt-1 text-white/80">
              {user.bio || "No bio yet"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-white/10">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-1 py-3 text-center text-xs tracking-wider ${
              activeTab === "posts"
                ? "border-t-2 border-blue-500 text-white"
                : "text-white/60"
            }`}
          >
            POSTS
          </button>
        </div>

        {/* Posts Grid */}
        <div className="grid grid-cols-3 gap-1 p-1">
          {userPosts.length > 0 ? (
            userPosts.map((post) => (
              <motion.div
                key={post._id}
                className="aspect-square relative group cursor-pointer"
                whileHover={{ scale: 0.985 }}
                onClick={() => setSelectedPost(post)}
              >
                <img
                  src={post.imageUrl}
                  alt="Post"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "/default-post.png";
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <div className="flex space-x-6 text-white">
                    <button
                      className="flex items-center focus:outline-none"
                      disabled={likeLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLikeToggle(post._id);
                      }}
                    >
                      {post.isLiked ? (
                        <AiFillHeart size={22} className="mr-1 text-red-500" />
                      ) : (
                        <AiOutlineHeart size={22} className="mr-1" />
                      )}
                      {post.likeCount ?? 0}
                    </button>
                    <span className="flex items-center">
                      <FiMessageCircle size={22} className="mr-1" />
                      {post.commentCount ?? 0}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-3 py-16 text-center">
              <div className="mx-auto w-16 h-16 border-2 border-white rounded-full flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-light mb-2">No Posts Yet</h2>
              <p className="text-sm text-white/70 max-w-md mx-auto">
                When you share photos and videos, they'll appear on your
                profile.
              </p>
              <button
                onClick={() => setShowCreatePostModal(true)}
                className="mt-4 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500"
              >
                Create Your First Post
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col sm:items-center sm:justify-center p-0 sm:p-4">
          <button
            onClick={() => setSelectedPost(null)}
            className="absolute top-4 right-4 text-white z-10 p-2 rounded-full hover:bg-white/10"
          >
            <FiX size={22} />
          </button>

          <div className="flex-1 sm:flex-none w-full sm:max-w-5xl bg-[#0f1522] flex flex-col sm:flex-row sm:rounded-xl overflow-hidden ring-1 ring-white/10">
            {/* Image */}
            <div className="w-full sm:w-2/3 bg-black flex items-center justify-center h-72 sm:h-auto">
              <img
                src={selectedPost.imageUrl}
                alt="Post"
                className="w-full h-full object-contain max-h-[60vh] sm:max-h-[80vh]"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/default-post.png";
                }}
              />
            </div>

            {/* Content */}
            <div className="w-full sm:w-1/3 p-4 flex flex-col overflow-y-auto">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-blue-500/40 mr-3">
                  <img
                    src={user.profilePicture}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="font-semibold">{user.username}</span>
              </div>

              <div className="border-b border-white/10 pb-4 mb-4 flex-1">
                {editingPost?._id === selectedPost._id ? (
                  <form onSubmit={handleEditPost} className="h-full flex flex-col">
                    <textarea
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      className="flex-1 w-full px-3 py-2 rounded-lg bg-[#0f1522] border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      rows={3}
                      maxLength={2200}
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPost(null);
                          setEditCaption("");
                        }}
                        className="px-3 py-1 text-sm bg-white/10 rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 text-sm bg-blue-600 rounded"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="h-full flex flex-col">
                      <div className="flex-1">
                        <p className="whitespace-pre-line">
                          {selectedPost.caption}
                        </p>
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => {
                            setEditingPost(selectedPost);
                            setEditCaption(selectedPost.caption);
                          }}
                          className="p-1 text-white/70 hover:text-blue-400"
                        >
                          <FiEdit size={18} />
                        </button>
                        <button
                          onClick={() => handleDeletePost(selectedPost._id)}
                          className="p-1 text-white/70 hover:text-red-400"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-6 text-sm mb-2">
                <button
                  className="flex items-center focus:outline-none"
                  disabled={likeLoading}
                  onClick={() => handleLikeToggle(selectedPost._id)}
                >
                  {likesData.isLiked ? (
                    <AiFillHeart size={20} className="mr-1 text-red-500" />
                  ) : (
                    <AiOutlineHeart size={20} className="mr-1" />
                  )}
                  {likesData.likeCount}
                </button>
                <button
                  className="flex items-center focus:outline-none"
                  onClick={() => setShowLikesModal(true)}
                  title="Show likes"
                >
                  <FiMessageCircle size={20} className="mr-1" />
                  {comments.length}
                </button>
              </div>

              {/* Comments */}
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mb-2">
                {comments.length === 0 ? (
                  <div className="text-white/50 text-sm text-center py-2">
                    No comments yet.
                  </div>
                ) : (
                  comments.map((c) => (
                    <div
                      key={c._id}
                      className="flex items-start gap-2 bg-white/5 rounded-lg p-2"
                    >
                      <img
                        src={getFullImageUrl(c.user.profilePicture)}
                        alt={c.user.username}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/default-profile.png";
                        }}
                      />
                      <div className="flex-1">
                        <span className="font-semibold text-xs">
                          {c.user.username}
                        </span>
                        <p className="text-xs break-words">{c.text}</p>
                        <span className="text-[10px] text-white/40">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment */}
              <form onSubmit={handleCommentSubmit} className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-2 py-2 rounded-lg bg-[#0f1522] border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  maxLength={220}
                  disabled={commentLoading}
                />
                <button
                  type="submit"
                  disabled={commentLoading || !commentText.trim()}
                  className="px-3 py-2 bg-blue-600 rounded-lg text-sm disabled:bg-blue-600/40"
                >
                  {commentLoading ? "Posting..." : "Post"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {toast.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg bg-green-600 text-white shadow-lg">
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default Profile;
