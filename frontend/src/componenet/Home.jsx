import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiHeart, FiMoreHorizontal, FiTrash2 } from 'react-icons/fi';
import { FaHeart, FaRegComment } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";
  const token = localStorage.getItem("access_token");

  const api = axios.create({
    baseURL: BASE_URL,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    withCredentials: true,
  });

  const [feedData, setFeedData] = useState(null);
  const [error, setError] = useState(null);

  // Likes state
  const [likedPosts, setLikedPosts] = useState({});         // postId -> boolean
  const [likeCounts, setLikeCounts] = useState({});          // postId -> number
  const [likesUsers, setLikesUsers] = useState({});          // postId -> array of users who liked
  const [likeLoading, setLikeLoading] = useState({});        // postId -> boolean (for toggling)
  const [likesVisible, setLikesVisible] = useState({});      // postId -> boolean (UI toggle for showing list)

  // Comments state
  const [commentInputs, setCommentInputs] = useState({});    // postId -> text
  const [comments, setComments] = useState({});              // postId -> array
  const [commentLoading, setCommentLoading] = useState({});  // postId -> boolean (for adding)
  const [commentsPage, setCommentsPage] = useState({});      // postId -> { page, limit, total, hasNext, loading }
  const [commentsVisible, setCommentsVisible] = useState({}); // postId -> boolean (UI toggle for showing comments)
  
  // Comment menu state
  const [commentMenuOpen, setCommentMenuOpen] = useState(null); // { postId: postId, commentId: commentId }
  const [deleteLoading, setDeleteLoading] = useState(null); // commentId that is being deleted

  const navigate = useNavigate();
  const currentUserId = localStorage.getItem("userId"); // Assuming user ID is stored during login

  const getFullImageUrl = (url) => {
    if (!url) return "/default-avatar.jpg";
    return url.startsWith("http")
      ? url
      : `${BASE_URL.replace("/api", "")}${url}`;
  };

  const normalizeComment = (comment) => ({
    _id: comment._id,
    text: comment.text,
    createdAt: comment.createdAt,
    user: {
      _id: comment.user?._id,
      username: comment.user?.username || 'Unknown',
      profilePicture: comment.user?.profilePicture || '/default-avatar.jpg'
    }
  });

  const normalizeLikeUser = (u) => ({
    _id: u._id,
    username: u.username || 'Unknown',
    profilePicture: u.profilePicture || '/default-avatar.jpg'
  });

  // Initial feed + eager load comments page 1 and likes for each post
  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const response = await api.get('/explore');

        const filteredData = {
          ...response.data,
          users: response.data.users
            .map(user => ({
              ...user,
              posts: (user.posts || []).filter(post => post && post._id)
            }))
            .filter(user => user.posts.length > 0)
        };

        setFeedData(filteredData);

        // Prepare list of postIds
        const allPosts = filteredData.users.flatMap(u => u.posts);
        const postIds = allPosts.map(p => p._id).filter(id => typeof id === 'string' && id.length === 24);

        // Fetch initial comments (page 1) and likes for each post in parallel
        await Promise.all([
          ...postIds.map(id => fetchComments(id, 1, 10)),
          ...postIds.map(id => fetchLikes(id))
        ]);
      } catch (err) {
        setError(err.message || 'Failed to load feed');
      }
    };

    fetchFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch likes for a post: GET /likes/:postId
  const fetchLikes = async (postId) => {
    if (!postId || typeof postId !== 'string' || postId.length !== 24) {
      console.warn('fetchLikes: invalid postId', postId);
      return;
    }
    try {
      const res = await api.get(`/likes/${postId}`);
      if (res.data?.success) {
        const likeCount = res.data?.data?.likeCount ?? 0;
        const isLiked = !!res.data?.data?.isLiked;
        const users = (res.data?.data?.likes || []).map(normalizeLikeUser);

        setLikeCounts(prev => ({ ...prev, [postId]: likeCount }));
        setLikedPosts(prev => ({ ...prev, [postId]: isLiked }));
        setLikesUsers(prev => ({ ...prev, [postId]: users }));
      }
    } catch (err) {
      console.error('fetchLikes error', err);
    }
  };

  // Toggle likes list visibility per post (UI only)
  const toggleLikesVisible = (postId) => {
    setLikesVisible(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  // Toggle comments visibility per post (UI only)
  const toggleCommentsVisible = (postId) => {
    setCommentsVisible(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  // Fetch comments: GET /comments/:postId?page=&limit=
  const fetchComments = async (postId, page = 1, limit = 10) => {
    if (!postId || typeof postId !== 'string' || postId.length !== 24) {
      console.warn('fetchComments: invalid postId', postId);
      return;
    }

    setCommentsPage(prev => ({
      ...prev,
      [postId]: {
        ...(prev[postId] || { page: 0, limit, total: 0, hasNext: false }),
        loading: true
      }
    }));

    try {
      const res = await api.get(`/comments/${postId}`, { params: { page, limit } });
      if (res.data?.success) {
        const list = (res.data.data || []).map(normalizeComment);
        const hasNext = Boolean(res.data?.pagination?.next);
        const total = res.data?.count ?? list.length;

        setComments(prev => ({
          ...prev,
          [postId]: page === 1 ? list : [ ...(prev[postId] || []), ...list ]
        }));

        setCommentsPage(prev => ({
          ...prev,
          [postId]: { page, limit, total, hasNext, loading: false }
        }));
      } else {
        setCommentsPage(prev => ({
          ...prev,
          [postId]: { ...(prev[postId] || {}), loading: false }
        }));
      }
    } catch (err) {
      console.error('fetchComments error', err);
      setCommentsPage(prev => ({
        ...prev,
        [postId]: { ...(prev[postId] || {}), loading: false }
      }));
    }
  };

  const loadMoreComments = (postId) => {
    const meta = commentsPage[postId];
    if (!meta || meta.loading || !meta.hasNext) return;
    const nextPage = (meta.page || 1) + 1;
    fetchComments(postId, nextPage, meta.limit || 10);
  };

  // Like/Unlike post: POST /like/:postId
  const handleLikeToggle = async (postId) => {
    setLikeLoading(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await api.post(`/like/${postId}`);
      if (res.data?.success) {
        const isLiked = !!res.data?.data?.isLiked;
        const likeCount = res.data?.data?.likeCount ?? 0;

        // Update basic like states
        setLikedPosts(prev => ({ ...prev, [postId]: isLiked }));
        setLikeCounts(prev => ({ ...prev, [postId]: likeCount }));

        // Option 1: Optimistic update users list (optional)
        // If you have current user info available, you could add/remove them locally.
        // Option 2 (safer): Refetch full likes list to sync
        // await fetchLikes(postId);
      }
    } catch (err) {
      console.error('handleLikeToggle error', err);
    } finally {
      setLikeLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    if (!postId || typeof postId !== 'string' || postId.length !== 24) {
      console.error("Invalid postId detected:", postId);
      return;
    }

    setCommentLoading(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await api.post(`/comment/${postId}`, { text });
      if (res.data?.success) {
        const newComment = normalizeComment(res.data.data);
        setComments(prev => ({
          ...prev,
          [postId]: [newComment, ...(prev[postId] || [])]
        }));

        setCommentsPage(prev => ({
          ...prev,
          [postId]: {
            ...(prev[postId] || { page: 1, limit: 10 }),
            total: (prev[postId]?.total || 0) + 1
          }
        }));

        setCommentInputs(prev => ({ ...prev, [postId]: "" }));
      }
    } catch (err) {
      console.error("Error adding comment:", err);
      console.error("Error response:", err.response?.data);
    } finally {
      setCommentLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

const handleDeleteComment = async (postId, commentId) => {
  setDeleteLoading(commentId);
  try {
    console.log("Attempting to delete comment:", {
      postId,
      commentId,
      currentUserId,
      url: `/comment/${postId}/${commentId}`
    });
    
    // Test if the API instance is working
    console.log("API base URL:", BASE_URL);
    console.log("Token exists:", !!token);
    
    const res = await api.delete(`/comment/${postId}/${commentId}`);
    
    if (res.data?.success) {
      // Remove the comment from the state
      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(comment => comment._id !== commentId)
      }));

      // Update the comment count
      setCommentsPage(prev => ({
        ...prev,
        [postId]: {
          ...(prev[postId] || { page: 1, limit: 10 }),
          total: Math.max(0, (prev[postId]?.total || 0) - 1)
        }
      }));

      // Close the menu
      setCommentMenuOpen(null);
      
      console.log("Comment deleted successfully");
    } else {
      throw new Error(res.data?.message || "Failed to delete comment");
    }
  } catch (err) {
    console.error("Error deleting comment:", err);
    console.error("Error response:", err.response);
    
    // More specific error handling
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
      
      if (err.response.status === 404) {
        alert("Comment or post not found");
      } else if (err.response.status === 403) {
        alert("You can only delete your own comments");
      } else if (err.response.status === 401) {
        alert("Please login again");
      } else if (err.response.status === 400) {
        alert("Invalid request: " + (err.response.data.message || ""));
      } else {
        alert("Server error: " + (err.response.data.message || ""));
      }
    } else if (err.request) {
      // The request was made but no response was received
      console.error("No response received:", err.request);
      alert("Network error. Please check your connection.");
    } else {
      // Something happened in setting up the request
      console.error("Request setup error:", err.message);
      alert("Error: " + err.message);
    }
  } finally {
    setDeleteLoading(null);
  }
};

  const handleCommentInputChange = (postId, value) => {
    setCommentInputs(prev => ({ ...prev, [postId]: value }));
  };

  const toggleCommentMenu = (postId, commentId) => {
    if (commentMenuOpen && commentMenuOpen.postId === postId && commentMenuOpen.commentId === commentId) {
      setCommentMenuOpen(null);
    } else {
      setCommentMenuOpen({ postId, commentId });
    }
  };

  const renderSkeletonPosts = () => {
    return Array(3).fill(0).map((_, index) => (
      <div key={`skeleton-${index}`} className="mb-8 border-b border-gray-800 pb-6">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gray-700 animate-pulse"></div>
            <div className="w-20 h-4 bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div className="w-4 h-4 bg-gray-700 rounded animate-pulse"></div>
        </div>
        <div className="w-full aspect-square bg-gray-700 animate-pulse"></div>
        <div className="flex justify-between px-4 py-3">
          <div className="flex space-x-4">
            <div className="w-6 h-6 bg-gray-700 rounded animate-pulse"></div>
            <div className="w-6 h-6 bg-gray-700 rounded animate-pulse"></div>
            <div className="w-6 h-6 bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div className="w-6 h-6 bg-gray-700 rounded animate-pulse"></div>
        </div>
        <div className="px-4 mt-1">
          <div className="w-3/4 h-4 bg-gray-700 rounded animate-pulse mb-1"></div>
          <div className="w-1/2 h-4 bg-gray-700 rounded animate-pulse"></div>
        </div>
      </div>
    ));
  };

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900 text-white">
        <p>Error loading feed: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900 border-b border-gray-800 py-3 px-4">
        <div className="flex justify-between items-center max-w-screen-md mx-auto">
          <h1 className="text-xl font-semibold">DostiGram</h1>
          <div className="flex space-x-4" onClick={() => { navigate("/messages"); }}>
            <button className="text-xl">💬</button>
          </div>
        </div>
      </header>

      {/* Main Feed */}
      <main className="max-w-screen-md mx-auto pb-16">
        {!feedData ? (
          renderSkeletonPosts()
        ) : (
          feedData?.users?.flatMap(user =>
            user.posts.map(post => {
              const postId = post._id;
              const meta = commentsPage[postId] || { page: 0, limit: 10, total: 0, hasNext: false, loading: false };
              const postComments = comments[postId] || [];
              const likesList = likesUsers[postId] || [];
              const isLiked = !!likedPosts[postId];
              const likeCount = likeCounts[postId] ?? 0;
              const showLikes = !!likesVisible[postId];
              const showComments = !!commentsVisible[postId];

              return (
                <div key={postId} className="mb-8 border-b border-gray-800 pb-6">
                  {/* Post Header */}
                  <div className="flex items-center justify-between p-3">
                    <div
                      className="flex items-center space-x-3 cursor-pointer"
                      onClick={() => {
                        if (post?.authorInfo?._id) {
                          navigate(`/profile/${post.authorInfo._id}`);
                        } else {
                          console.warn("No authorInfo._id found for post:", post);
                        }
                      }}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-600">
                        <img
                          src={getFullImageUrl(post?.authorInfo?.profilePicture)}
                          alt={post?.authorInfo?.username || "User"}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.onerror = null; e.target.src = "/default-avatar.jpg"; }}
                        />
                      </div>
                      <span className="font-semibold">{post?.authorInfo?.username || "Unknown User"}</span>
                    </div>

                    <button><FiMoreHorizontal /></button>
                  </div>

                  {/* Post Image */}
                  <div className="w-full aspect-square bg-gray-800">
                    <img
                      src={getFullImageUrl(post.imageUrl)}
                      alt={post.caption}
                      className="w-full h-full object-cover"
                      onError={e => { e.target.onerror = null; e.target.src = "/default-post.jpg"; }}
                    />
                  </div>

                  {/* Post Actions */}
                  <div className="flex justify-between px-4 py-3">
                    <div className="flex space-x-4">
                      <button
                        onClick={() => handleLikeToggle(postId)}
                        className="text-2xl"
                        disabled={likeLoading[postId]}
                        aria-label="Like toggle"
                      >
                        {isLiked ? <FaHeart className="text-red-500" /> : <FiHeart />}
                      </button>

                      <button
                        className="text-2xl relative"
                        onClick={() => {
                          if (!commentsPage[postId]?.page) {
                            fetchComments(postId, 1, 10);
                          }
                          toggleCommentsVisible(postId);
                        }}
                        aria-label="Toggle comments"
                      >
                        <FaRegComment />
                        {meta.total > 0 && (
                          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {meta.total}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Toggle likes list */}
                    <button
                      className="text-sm text-blue-400"
                      onClick={() => {
                        if (!likesUsers[postId]) {
                          fetchLikes(postId);
                        }
                        toggleLikesVisible(postId);
                      }}
                    >
                      {showLikes ? 'Hide likes' : 'Show likes'}
                    </button>
                  </div>

                  {/* Likes summary */}
                  <div className="px-4 font-semibold">
                    {likeCount} {likeCount === 1 ? 'like' : 'likes'}
                  </div>

                  {/* Likes list (expandable) */}
                  {showLikes && (
                    <div className="px-4 mt-2">
                      {likesList.length === 0 ? (
                        <div className="text-gray-400 text-sm">No likes yet</div>
                      ) : (
                        likesList.map(liker => (
                          <div key={liker._id} className="flex items-center gap-2 mb-1">
                            <img
                              src={getFullImageUrl(liker.profilePicture)}
                              alt={liker.username}
                              className="w-6 h-6 rounded-full object-cover"
                              onError={e => { e.target.onerror = null; e.target.src = "/default-avatar.jpg"; }}
                            />
                            <span className="text-sm">{liker.username}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Caption */}
                  <div className="px-4 mt-1">
                    <span>{post.caption}</span>
                  </div>

                  {/* Comments - Only show if comments are toggled visible */}
                  {showComments && (
                    <div className="px-4 mt-2">
                      {postComments.map((comment) => (
                        <div key={comment._id} className="mb-1 flex items-center gap-2 group relative">
                          {comment.user?.profilePicture && (
                            <img
                              src={getFullImageUrl(comment.user.profilePicture)}
                              alt={comment.user.username}
                              className="w-6 h-6 rounded-full object-cover"
                              onError={e => { e.target.onerror = null; e.target.src = "/default-avatar.jpg"; }}
                            />
                          )}
                          <div className="flex-1">
                            <span className="font-semibold mr-2">{comment.user?.username}</span>
                            <span>{comment.text}</span>
                          </div>
                          
                          {/* Three dots menu for user's own comments - ALWAYS VISIBLE */}
                          {comment.user?._id === currentUserId && (
                            <div className="ml-2 relative">
                              <button 
                                className="text-gray-400 hover:text-white transition-colors"
                                onClick={() => toggleCommentMenu(postId, comment._id)}
                              >
                                <FiMoreHorizontal size={16} />
                              </button>
                              
                              {/* Delete menu */}
                              {commentMenuOpen && commentMenuOpen.postId === postId && commentMenuOpen.commentId === comment._id && (
                                <div className="absolute right-0 top-6 bg-gray-800 rounded-md shadow-lg z-10 p-2 border border-gray-700">
                                  <button
                                    className="flex items-center gap-2 text-red-500 hover:bg-gray-700 w-full p-2 rounded"
                                    onClick={() => handleDeleteComment(postId, comment._id)}
                                    disabled={deleteLoading === comment._id}
                                  >
                                    <FiTrash2 size={14} />
                                    {deleteLoading === comment._id ? 'Deleting...' : 'Delete'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Comments count and pagination */}
                      <div className="mt-2 text-sm text-gray-400">
                        <span>Total comments: {meta.total || postComments.length}</span>
                      </div>
                      {meta.hasNext && (
                        <div className="mt-2">
                          <button
                            className="text-blue-400 font-semibold disabled:opacity-50"
                            onClick={() => loadMoreComments(postId)}
                            disabled={meta.loading}
                          >
                            {meta.loading ? 'Loading...' : 'Load more comments'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="px-4 mt-2 text-gray-400 text-xs">
                    {new Date(post.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>

                  {/* Add Comment */}
                  <div className="px-4 mt-3 flex items-center border-t border-gray-800 pt-3">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      className="bg-transparent border-none w-full focus:outline-none"
                      value={commentInputs[postId] || ""}
                      onChange={e => handleCommentInputChange(postId, e.target.value)}
                      disabled={commentLoading[postId]}
                      onKeyDown={e => e.key === 'Enter' && handleAddComment(postId)}
                    />
                    <button
                      className={`text-blue-400 font-semibold ${commentInputs[postId] ? '' : 'opacity-50'}`}
                      onClick={() => handleAddComment(postId)}
                      disabled={commentLoading[postId] || !(commentInputs[postId] && commentInputs[postId].trim())}
                    >
                      {commentLoading[postId] ? "Posting..." : "Post"}
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}
      </main>
    </div>
  );
};

export default Home;