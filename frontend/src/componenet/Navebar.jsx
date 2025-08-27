import React, { useEffect, useState } from "react";
import axios from "axios";
import { AiFillHome, AiOutlineHome } from "react-icons/ai";
import { FiSearch } from "react-icons/fi";
import { BsChatDots } from "react-icons/bs";
import { FaUserCircle } from "react-icons/fa"; // <-- profile fallback icon
import { Link, useLocation } from "react-router-dom";

const BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";
const token = localStorage.getItem("access_token");

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  },
});

const Navbar = () => {
  const location = useLocation();
  const [profileImage, setProfileImage] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProfileImage = async () => {
      try {
        const res = await api.get("/profile-picture");
        if (res.data?.success && res.data?.profilePicture && isMounted) {
          const imageUrl = res.data.profilePicture.startsWith("http")
            ? res.data.profilePicture
            : `${BASE_URL.replace("/api", "")}${res.data.profilePicture}`;
          setProfileImage(imageUrl);
        }
      } catch (err) {
        console.error("Error fetching profile image:", err);
      }
    };

    fetchProfileImage();
    const interval = setInterval(fetchProfileImage, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const icons = [
    {
      path: "/home",
      icon: <AiOutlineHome className="text-2xl" />,
      activeIcon: <AiFillHome className="text-2xl" />,
      label: "Home",
    },
    {
      path: "/search",
      icon: <FiSearch className="text-2xl" />,
      activeIcon: <FiSearch className="text-2xl" />,
      label: "Search",
    },
    {
      path: "/messages",
      icon: <BsChatDots className="text-2xl" />,
      activeIcon: <BsChatDots className="text-2xl" />,
      label: "Chats",
    },
    {
      path: "/profile",
      icon: profileImage ? (
        <img
          src={profileImage}
          alt="Profile"
          className="w-8 h-8 rounded-full object-cover border border-gray-600"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "";
            setProfileImage(null);
          }}
        />
      ) : (
        // <-- SVG ki jagah React Icon
        <FaUserCircle className="text-3xl" />
      ),
      activeIcon: profileImage ? (
        <img
          src={profileImage}
          alt="Profile"
          className="w-8 h-8 rounded-full object-cover border-2 border-white"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "";
            setProfileImage(null);
          }}
        />
      ) : (
        <FaUserCircle className="text-3xl" />
      ),
      label: "Profile",
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-gray-900/90 backdrop-blur-md flex justify-around items-center py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.3)] z-50 border-t border-white/10">
      {icons.map(({ path, icon, activeIcon, label }) => {
        const isActive = location.pathname === path;
        return (
          <Link
            key={path}
            to={path}
            aria-label={label}
            className={`flex text-white items-center justify-center w-12 h-12 rounded-full transition-all duration-200 ${
              isActive ? "bg-gray-800 shadow-inner" : "hover:bg-gray-800"
            }`}
          >
            {isActive ? activeIcon : icon}
          </Link>
        );
      })}
    </div>
  );
};

export default Navbar;
