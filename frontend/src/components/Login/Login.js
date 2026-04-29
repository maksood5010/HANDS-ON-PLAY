import './Login.css';
import { useState } from "react";
import { authAPI } from "../../services/api";
import PasswordInput from "../common/PasswordInput";

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authAPI.login(username, password);

      if (response.success) {
        // Store user info in localStorage
        localStorage.setItem("user", JSON.stringify(response.user));
        onLoginSuccess(response.user);
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-split-container">
      {/* Left Panel */}
      <div className="login-left-panel">
        <div className="left-panel-content">
          <h1 className="brand-title">Digital Signage</h1>
          <p className="brand-subtitle">
            The ultimate platform for managing your displays everywhere
          </p>
          
        </div>
        
        {/* Decorative curves */}
        <div className="decorative-curves">
          <svg viewBox="0 0 500 500" preserveAspectRatio="none">
            <path d="M0,500 C150,450 300,500 500,200 L500,500 Z" fill="rgba(255,255,255,0.03)" />
            <path d="M0,500 C100,350 250,500 500,300 L500,500 Z" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
            <path d="M0,500 C200,400 350,500 500,100 L500,500 Z" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          </svg>
        </div>
      </div>

      {/* Right Panel */}
      <div className="login-right-panel">
        <div className="login-form-container">
          <div className="login-header">
            <h2>Hello Again!</h2>
            <p>Welcome Back</p>
          </div>
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <div className="login-input-wrapper">
                <span className="input-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                </span>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username or Email Address"
                  required
                  autoComplete="username"
                  className="pill-input"
                />
              </div>
            </div>
            <div className="form-group">
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="current-password"
                className="login-input-wrapper"
                inputClassName="pill-input"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                }
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            
            <button type="submit" disabled={loading} className="login-button-pill">
              {loading ? <span className="loader"></span> : "Login"}
            </button>
            
            <div className="forgot-password-link">
              <a href="#forgot">Forgot Password</a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;

