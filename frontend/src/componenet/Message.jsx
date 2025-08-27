import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { FiSearch } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const LAST_MSG_USER = "last_messaged_user_id";

const Message = () => {
  const BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";
  const token = localStorage.getItem("access_token");
  const loggedInUserId = localStorage.getItem("userId"); // saved at login

  const api = useMemo(
    () =>
      axios.create({
        baseURL: BASE_URL,
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        withCredentials: true,
      }),
    [BASE_URL, token]
  );

  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [orderedUsers, setOrderedUsers] = useState([]); // after applying “last messaged” priority
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  // Fetch all users (existing behavior)
  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      try {
        const res = await api.get("/usernames");
        if (res.data?.success && Array.isArray(res.data.users)) {
          if (!isMounted) return;
          setUsers(res.data.users);
          setFilteredUsers(res.data.users);
        }
      } catch (error) {
        console.error("Error fetching usernames:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, [api]);

  // Search filter
  const handleSearchChange = (e) => {
    const value = e.target.value.toLowerCase();
    setSearchText(value);
    const next = users.filter((user) =>
      user.username.toLowerCase().includes(value)
    );
    setFilteredUsers(next);
  };

  // Reorder to put last messaged on top
  useEffect(() => {
    const lastId = localStorage.getItem(LAST_MSG_USER);
    if (!lastId) {
      setOrderedUsers(filteredUsers);
      return;
    }
    if (!Array.isArray(filteredUsers) || filteredUsers.length === 0) {
      setOrderedUsers(filteredUsers);
      return;
    }
    // Find the last messaged user and move to top if present in current filtered list
    const idx = filteredUsers.findIndex((u) => String(u._id) === String(lastId));
    if (idx === -1) {
      setOrderedUsers(filteredUsers);
      return;
    }
    const arr = [...filteredUsers];
    const [lastUser] = arr.splice(idx, 1);
    setOrderedUsers([lastUser, ...arr]);
  }, [filteredUsers]);

  const handleUserClick = (receiverId) => {
    if (!receiverId) {
      console.warn("No receiverId");
      return;
    }
    if (!loggedInUserId) {
      console.warn("No loggedInUserId in localStorage");
      return;
    }
    try {
      localStorage.setItem(LAST_MSG_USER, String(receiverId));
    } catch {}
    const url = `/messages/${loggedInUserId}/${receiverId}`;
    navigate(url);
  };

  const SearchSkeleton = () => (
    <div className="space-y-3">
      {Array(5)
        .fill(0)
        .map((_, index) => (
          <div key={index} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="w-10 h-10 bg-gray-800 rounded-full"></div>
            <div className="h-4 bg-gray-800 rounded w-3/4"></div>
          </div>
        ))}
    </div>
  );

  return (
    <div className="bg-black min-h-screen text-white p-4 z-[99999] relative">
      <div className="flex items-center gap-2 mb-6 border border-gray-700 rounded-lg px-3 py-2 bg-[#121212]">
        <FiSearch className="text-gray-400 text-lg" />
        <input
          type="text"
          placeholder="Search users"
          className="bg-transparent outline-none text-gray-300 w-full"
          value={searchText}
          onChange={handleSearchChange}
        />
      </div>

      {isLoading ? (
        <SearchSkeleton />
      ) : orderedUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <FiSearch className="text-gray-400 text-4xl mb-4" />
          <p className="text-gray-400">No users found</p>
          {searchText && (
            <p className="text-gray-500 text-sm mt-1">Try searching for something else</p>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {orderedUsers.map((user) => {
            const isYou = loggedInUserId && String(user._id) === String(loggedInUserId);
            return (
              <li
                key={user._id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1c1c1c] cursor-pointer transition"
                onClick={() => handleUserClick(user._id)}
              >
                <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700">
                  {user.profilePicture ? (
                    <img
                      src={`${BASE_URL.replace("/api", "")}${user.profilePicture}`}
                      alt={user.username}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/default-avatar.jpg";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white font-bold">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <span className="text-gray-200 font-medium block truncate">
                    {user.username} {isYou && <span className="text-blue-400 ml-1">(You)</span>}
                  </span>
                  {user.fullName && (
                    <span className="text-gray-400 text-sm block truncate">
                      {user.fullName}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default Message;
