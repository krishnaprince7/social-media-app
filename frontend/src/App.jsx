import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Register from "./componenet/Register";
import Login from "./componenet/Login";
import Home from "./componenet/Home";
import Layout from "./layout/Layout";
import Search from "./componenet/Search";
import Profile from "./componenet/Profile";
import Message from "./componenet/Message";
import ProfileBio from "./componenet/ProfileBio";
import MyProfile from "./componenet/MyProfile";
import ChatMessages from "./componenet/ChatMessages";
import ProtectedRoute from "./componenet/ProtectedRoute";


const App = () => {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected but outside Layout */}
        <Route
          path="/profile-bio"
          element={
            <ProtectedRoute>
              <ProfileBio />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/:senderId/:receiverId"
          element={
            <ProtectedRoute>
              <ChatMessages />
            </ProtectedRoute>
          }
        />

        {/* Protected routes with layout */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/home" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/messages" element={<Message />} />
          <Route path="/profile/:id" element={<MyProfile />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
