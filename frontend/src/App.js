import './styles/App.css';
import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Playlists from "./pages/Playlists";
import Devices from "./pages/Devices";
import DeviceGroups from "./pages/DeviceGroups";
import Users from "./pages/Users";
import Companies from "./pages/Companies";

function App() {
  // Initialize authentication state from localStorage synchronously
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return !!savedUser;
  });
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    // Check if user is already logged in (for cases where localStorage changes externally)
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsAuthenticated(true);
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLoginSuccess={handleLoginSuccess} />
            )
          } 
        />
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <Layout user={user} onLogout={handleLogout}>
                <Dashboard />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/playlists"
          element={
            isAuthenticated ? (
              <Layout user={user} onLogout={handleLogout}>
                <Playlists />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/devices"
          element={
            isAuthenticated ? (
              <Layout user={user} onLogout={handleLogout}>
                <Devices />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/device-groups"
          element={
            isAuthenticated ? (
              <Layout user={user} onLogout={handleLogout}>
                <DeviceGroups />
              </Layout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/users"
          element={
            isAuthenticated ? (
              user?.role === "company_admin" || user?.role === "platform_super_admin" ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Users />
                </Layout>
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/companies"
          element={
            isAuthenticated ? (
              user?.role === "platform_super_admin" ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Companies />
                </Layout>
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route 
          path="/" 
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
