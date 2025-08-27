import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const ProfileBio = () => {
  const BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";
  const token = localStorage.getItem("access_token");
  const navigate = useNavigate();

  const api = axios.create({
    baseURL: BASE_URL,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    withCredentials: true,
  });

  const [formData, setFormData] = useState({
    bio: '',
    profilePicture: null
  });
  const [previewImage, setPreviewImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, profilePicture: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('bio', formData.bio);
      if (formData.profilePicture) {
        formDataToSend.append('profilePicture', formData.profilePicture);
      }

      const res = await api.put('/update-profile', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data.success) {
        toast.success('🔥 Profile updated successfully!');
        navigate('/home'); // Redirect after successful update
      }
    } catch (err) {
      toast.error(err.response?.data?.message || '❌ Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    toast.info('Profile setup skipped');
    navigate('/home');
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        background: "linear-gradient(120deg, #520b6c 0%, #27064b 60%, #29166f 100%)",
        overflow: "hidden",
      }}
    >
      {/* Radial overlay to match login */}
      <div
        style={{
          position: "absolute",
          width: "100vw",
          height: "100vh",
          left: 0,
          top: 0,
          background: "radial-gradient(circle at 60% 40%, rgba(170,0,90,0.25) 0%, rgba(39,6,75,0.6) 90%)",
          zIndex: 0,
        }}
      />

      <ToastContainer
        position="top-right"
        autoClose={3000}
        toastClassName="shadow-lg rounded-xl bg-gray-900/80 backdrop-blur-md border border-gray-700"
        progressClassName="bg-gradient-to-r from-orange-500 to-red-600"
        bodyClassName="font-medium text-white"
      />

      <div
        className="flex flex-col md:flex-row w-full max-w-4xl items-center justify-center bg-transparent relative rounded-3xl shadow-2xl p-0 overflow-hidden z-10"
        style={{ minHeight: 550, gap: "2rem" }}
      >
        {/* Right side illustration for desktop (same as login) */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="hidden md:flex flex-col items-center justify-center w-2/5 h-full relative"
          style={{
            background: "linear-gradient(135deg, rgba(128,12,204,0.93) 0%, #fd297b 100%)",
            borderRadius: "1.5rem",
            minHeight: 480,
            marginLeft: 24,
            boxShadow: "0 6px 30px 9px #8039ca2c",
            zIndex: 10,
            padding: "1.5rem",
          }}
        >
          <img
            src="/images/man.png"
            alt="Cartoon user illustration"
            className="w-full max-w-xs object-contain mx-auto drop-shadow-2xl"
            draggable="false"
            style={{
              marginTop: 0,
              filter: "drop-shadow(0 0 24px #e53d87)",
            }}
          />
        </motion.div>

        {/* Form Card (mirrors login card styles) */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md p-0 relative z-20"
          style={{
            background: "linear-gradient(120deg, rgba(30,30,58,0.93) 60%, rgba(58,14,74,0.88) 100%)",
            borderRadius: "1.5rem",
            boxShadow: "0 8px 40px 7px rgba(200,85,174,0.36)",
            padding: "3rem 2.5rem",
            minHeight: 450,
            transition: "opacity 0.3s ease",
          }}
        >
          <h1
            className="text-2xl sm:text-3xl font-bold mb-8 text-center"
            style={{
              color: "#fff",
              letterSpacing: 1,
              textShadow: "0 1px 12px #520b6c, 0 2px 18px #91336c",
            }}
          >
            Complete your profile
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture picker in card style */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: "#e1a9ff" }}>
                Profile Picture
              </label>
              <label
                className="cursor-pointer w-full flex items-center justify-center"
                style={{ gap: "1rem" }}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div
  className="relative w-20 h-20 rounded-full border flex items-center justify-center overflow-hidden group"
  style={{ border: "1.5px solid #ae48ff", background: "rgba(49,22,79,0.5)" }}
>
  {previewImage ? (
    <img
      src={previewImage}
      alt="Profile"
      className="w-full h-full object-cover"
    />
  ) : (
    <span className="text-xs text-center" style={{ color: "#e1a9ff" }}>
      Click to upload
    </span>
  )}

  {/* Overlay effect for update look */}
  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity duration-300">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-white mb-1"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M15.232 5.232l3.536 3.536M9 13h3l7-7a2.121 2.121 0 10-3-3l-7 7v3z"
      />
    </svg>
    <span className="text-xs text-white">Update</span>
  </div>
</div>

                {previewImage && (
                  <span className="text-xs" style={{ color: "#e1a9ff" }}>
                    Change photo
                  </span>
                )}
              </label>
            </div>

            {/* Bio input styled like login inputs */}
            <div>
              <label
                htmlFor="bio"
                className="block text-sm font-medium mb-2"
                style={{ color: "#e1a9ff" }}
              >
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Tell us about yourself (optional)..."
                rows={4}
                className="w-full pl-4 pr-4 py-4 rounded-md outline-none"
                style={{
                  color: "#fff",
                  background: "rgba(49,22,79,0.88)",
                  border: "1.5px solid #ae48ff",
                  fontSize: 16,
                  letterSpacing: 0.1,
                }}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
              >
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-md font-bold text-white text-base transition-all duration-300 shadow-lg"
                  style={{
                    background: "linear-gradient(90deg, #e34e99 0%, #ff398b 100%)",
                    border: "none",
                    outline: "none",
                    boxShadow: "0 2px 13px 2px #fd46af8c",
                    letterSpacing: 1.3,
                    cursor: loading ? "not-allowed" : "pointer",
                    transform: isHovered && !loading ? "scale(1.02)" : "scale(1)",
                  }}
                >
                  {loading ? "Saving..." : "Uplode"}
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full py-3 px-4 rounded-md font-medium transition-all duration-300"
                  style={{
                    color: "#e1a9ff",
                    border: "1.5px solid #ae48ff",
                  }}
                >
                  Skip for now
                </button>
              </motion.div>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Phone screen background image behind form (same as login) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="md:hidden absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(128,12,204,0.93) 0%, #fd297b 100%)",
          borderRadius: "1.5rem",
          overflow: "hidden",
          padding: "1rem",
        }}
      >
        <img
          src="/images/man.png"
          alt="Cartoon user illustration"
          className="w-full h-full object-contain object-center select-none rounded-xl"
          draggable="false"
          style={{ filter: "drop-shadow(0 0 24px #e53d87)", opacity: 1 }}
        />
      </motion.div>

      {/* Match login’s mobile opacity + reduced motion fallback */}
      <style>
        {`
          @media (max-width: 767px) {
            .z-20 {
              opacity: 0.75 !important;
              transition: opacity 0.3s;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            * {
              animation-duration: 0.001ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.001ms !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default ProfileBio;
