import React, { useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

const Register = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const res = await api.post("/register", formData);
      if (res.data.success) {
        toast.success("🚀 Account created successfully!");
        setFormData({ username: "", email: "", password: "" });
        setTimeout(() => navigate("/login"), 1500);
      } else {
        setErrors(res.data.errors || {});
        toast.error("❌ Registration failed!");
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({ general: "Something went wrong. Please try again." });
      }
      toast.error("❌ Registration failed!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        background: "linear-gradient(120deg, #520b6c 0%, #27064b 60%, #29166f 100%)",
        overflow: "hidden",
      }}
    >
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
        {/* Right side illustration for desktop */}
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

        {/* Register Form Card */}
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
            opacity: window.innerWidth < 768 ? 0.75 : 1,
            transition: "opacity 0.3s ease",
          }}
        >
          <h2
            className="text-2xl sm:text-3xl font-bold mb-8 text-center"
            style={{
              color: "#fff",
              letterSpacing: 1,
              textShadow: "0 1px 12px #520b6c, 0 2px 18px #91336c",
            }}
          >
            Create your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium mb-2"
                style={{ color: "#e1a9ff" }}
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
                className="w-full pl-4 pr-4 py-4 rounded-md outline-none"
                style={{
                  color: "#fff",
                  background: "rgba(49,22,79,0.88)",
                  border: "1.5px solid #ae48ff",
                  fontSize: 16,
                  letterSpacing: 0.2,
                  marginBottom: errors.username ? 6 : 24,
                }}
              />
              {errors.username && (
                <div className="text-red-400 text-sm mt-1">{errors.username}</div>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-2"
                style={{ color: "#e1a9ff" }}
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className="w-full pl-4 pr-4 py-4 rounded-md outline-none"
                style={{
                  color: "#fff",
                  background: "rgba(49,22,79,0.88)",
                  border: "1.5px solid #ae48ff",
                  fontSize: 16,
                  letterSpacing: 0.2,
                  marginBottom: errors.email ? 6 : 24,
                }}
              />
              {errors.email && (
                <div className="text-red-400 text-sm mt-1">{errors.email}</div>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-2"
                style={{ color: "#e1a9ff" }}
              >
                Password 
              </label>
             <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                 onChange={handleChange} 
                placeholder="Enter your password"
                className="w-full pl-4 pr-4 py-4 rounded-md outline-none"
                style={{
                  color: "#fff",
                  background: "rgba(49,22,79,0.88)",
                  border: "1.5px solid #ae48ff",
                  fontSize: 16,
                  letterSpacing: 0.2,
                  marginBottom: errors.password ? 6 : 24,
                }}
              />
              {errors.password && (
                <div className="text-red-400 text-sm mt-1">{errors.password}</div>
              )}
            </div>

            {/* Submit Button */}
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
              }}
            >
              {loading ? "Registering..." : "REGISTER"}
            </button>

            {errors.general && (
              <div className="my-3 p-3 text-sm text-red-200 bg-red-900/60 border border-red-400 rounded-md">
                {errors.general}
              </div>
            )}
          </form>

          <div className="mt-8 text-center text-xs text-gray-300">
            Already have an account?{" "}
            <Link to="/login" className="text-pink-400 font-semibold underline">
              Sign in here.
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Phone screen background image behind form */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="md:hidden absolute inset-0 z-0"
        style={{
          background: "linear-gradient(135deg, rgba(128,12,204,0.93) 0%, #fd297b 100%)",
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

      <style>
        {`
          @media (max-width: 767px) {
            .z-20 {
              opacity: 0.75 !important;
              transition: opacity 0.3s;
            }
          }
        `}
      </style>
    </div>
  );
};

export default Register;
