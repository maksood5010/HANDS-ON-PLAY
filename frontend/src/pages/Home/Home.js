import './Home.css';
import { useEffect, useState } from "react";
import { messageAPI } from "../../services/api";

function Home({ user, onLogout }) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    messageAPI.getMessage()
      .then(res => setMessage(res.message))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="home-container">
      <div className="header">
        <h1>Digital Signage App</h1>
        <div className="user-info">
          <span>Welcome, {user?.username}!</span>
          <button onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>
      <div className="content">
        <p>{message}</p>
      </div>
    </div>
  );
}

export default Home;

