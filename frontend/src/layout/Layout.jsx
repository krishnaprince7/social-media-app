import React from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../componenet/Navebar";

const Layout = () => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Main content */}
      <div className="flex-1">
        <Outlet />
      </div>

      {/* Navbar always at bottom */}
      <Navbar />
    </div>
  );
};

export default Layout;
