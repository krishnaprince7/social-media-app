import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FiSearch, FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const LS_SELECTED_KEY = "search_selected_user";
const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 1; // start suggesting after 1+ chars

const Search = () => {
  const BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";
  const API_HOST = useMemo(() => BASE_URL.replace(/\/api\/?$/, ""), [BASE_URL]);
  const token = localStorage.getItem("access_token");

  const api = useMemo(() => {
    const inst = axios.create({
      baseURL: BASE_URL,
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    return inst;
  }, [BASE_URL, token]);

  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]); // live results
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [open, setOpen] = useState(false); // suggestions panel open/closed
  const [activeIndex, setActiveIndex] = useState(-1); // keyboard selection
  const [selectedUser, setSelectedUser] = useState(null); // pinned

  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Load pinned user from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_SELECTED_KEY);
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u._id) setSelectedUser(u);
      }
    } catch {}
  }, []);

  // Debounced live fetch on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.trim().length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        // Expecting GET /usernames?q=query -> { success: true, users: [...] }
        const res = await api.get("/usernames", { params: { q: query.trim() } });
        let users = [];
        if (res?.data?.success && Array.isArray(res.data.users)) {
          users = res.data.users;
        } else if (Array.isArray(res?.data)) {
          users = res.data;
        }
        setSuggestions(users);
        setOpen(true);
        setActiveIndex(users.length ? 0 : -1);
      } catch (e) {
        console.error("suggestions error:", e);
        setErrorMsg("Failed to load suggestions");
        setSuggestions([]);
        setOpen(true);
        setActiveIndex(-1);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [api, query]);

  // Helpers
  const normalizeImg = (p) => {
    if (!p) return "";
    if (/^https?:\/\//i.test(p)) return p;
    const path = p.startsWith("/") ? p : `/${p}`;
    return `${API_HOST}${path}`;
  };

  const handleChange = (e) => {
    setQuery(e.target.value);
    setErrorMsg("");
  };

  const closePanel = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const pickUser = (user) => {
    setSelectedUser(user);
    try {
      localStorage.setItem(LS_SELECTED_KEY, JSON.stringify(user));
    } catch {}
    closePanel();
  };

  const clearPinned = () => {
    setSelectedUser(null);
    try {
      localStorage.removeItem(LS_SELECTED_KEY);
    } catch {}
  };

  // Keyboard navigation
  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        pickUser(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePanel();
    }
  };

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (!open) return;
      const inputEl = inputRef.current;
      const listEl = listRef.current;
      if (inputEl && inputEl.contains(e.target)) return;
      if (listEl && listEl.contains(e.target)) return;
      closePanel();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const Pfp = ({ user }) => (
    <div className="w-9 h-9 rounded-full overflow-hidden border border-gray-700 shrink-0">
      {user?.profilePicture ? (
        <img
          src={normalizeImg(user.profilePicture)}
          alt={user?.username}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/default-avatar.jpg";
          }}
        />
      ) : (
        <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white font-bold">
          {user?.username?.charAt(0)?.toUpperCase() || "?"}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-black min-h-screen text-white p-4">
      {/* Input */}
      <div
        ref={inputRef}
        className="relative flex items-center gap-2 mb-6 border border-gray-700 rounded-lg px-3 py-2 bg-[#121212]"
      >
        <FiSearch className="text-gray-400 text-lg" />
        <input
          type="text"
          placeholder="Search users"
          className="bg-transparent outline-none text-gray-300 w-full"
          value={query}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (suggestions.length) setOpen(true);
          }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setSuggestions([]);
              closePanel();
            }}
            className="text-gray-400 hover:text-gray-200"
            aria-label="Clear"
            title="Clear"
          >
            <FiX />
          </button>
        )}

        {/* Suggestions panel */}
        {open && (
          <div
            ref={listRef}
            className="absolute left-0 right-0 top-full mt-2 bg-[#1a1a1a] border border-gray-800 rounded-lg shadow-lg overflow-hidden z-50"
          >
            {loading ? (
              <div className="p-3 text-sm text-gray-400">Loading...</div>
            ) : errorMsg ? (
              <div className="p-3 text-sm text-red-400">{errorMsg}</div>
            ) : suggestions.length === 0 ? (
              <div className="p-3 text-sm text-gray-400">No results</div>
            ) : (
              <ul role="listbox">
                {suggestions.map((u, idx) => (
                  <li
                    key={u._id}
                    role="option"
                    aria-selected={activeIndex === idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickUser(u)}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${
                      activeIndex === idx ? "bg-[#2a2a2a]" : "hover:bg-[#222]"
                    }`}
                  >
                    <Pfp user={u} />
                    <div className="min-w-0">
                      <div className="text-gray-200 font-medium truncate">{u.username}</div>
                      {u.fullName && (
                        <div className="text-gray-400 text-xs truncate">{u.fullName}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Pinned user */}
      {selectedUser && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm text-gray-400 uppercase tracking-wide">Pinned</h3>
            <button
              onClick={clearPinned}
              className="flex items-center gap-1 text-gray-400 hover:text-gray-200 text-sm"
              title="Unpin"
            >
              <FiX /> Clear
            </button>
          </div>
          <div className="mt-2 flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a] border border-gray-800">
            <Pfp user={selectedUser} />
            <div className="flex-1 min-w-0">
              <span className="text-gray-200 font-medium block truncate">
                {selectedUser.username}
              </span>
              {selectedUser.fullName && (
                <span className="text-gray-400 text-sm block truncate">
                  {selectedUser.fullName}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate(`/profile/${selectedUser._id}`)}
              className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-xs"
            >
              View
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;
