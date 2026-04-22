import './Dashboard.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '../../services/api';

// Icon Components
const PlaylistIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15V6" />
    <path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    <path d="M12 12H3" />
    <path d="M16 6H3" />
    <path d="M12 18H3" />
  </svg>
);

const DeviceIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const ScheduleIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const SmallPlaylistIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const SmallDeviceIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const SmallScheduleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const TrendUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const formatLocalDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

function Dashboard() {
  const navigate = useNavigate();

  const companyName = (() => {
    const raw = localStorage.getItem("user");
    try {
      const u = raw ? JSON.parse(raw) : null;
      return u?.company_name || u?.companyName || "";
    } catch {
      return "";
    }
  })();

  const headerTitle = companyName || "Dashboard";

  const [stats, setStats] = useState(null);
  const [recentPlaylists, setRecentPlaylists] = useState([]);
  const [activeDevices, setActiveDevices] = useState([]);
  const [activeSchedules, setActiveSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await dashboardAPI.getSummary();
        setStats({
          playlists: {
            total: data.playlists?.total ?? 0,
            active: data.playlists?.active ?? 0,
            inactive: data.playlists?.inactive ?? 0,
          },
          devices: {
            total: data.devices?.total ?? 0,
            online: data.devices?.online ?? 0,
            offline: data.devices?.offline ?? 0,
          },
          schedules: {
            active: data.schedules?.active ?? 0,
            upcoming: data.schedules?.upcoming ?? 0,
            completed: data.schedules?.completed ?? 0,
          },
        });
        setRecentPlaylists(data.playlists?.recent || []);
        setActiveDevices(data.devices?.active || []);
        setActiveSchedules(data.schedules?.items || []);
        setError(null);
      } catch (err) {
        console.error('Failed to load dashboard summary', err);
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, []);

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1>{headerTitle}</h1>
            <p>Loading your digital signage overview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1>{headerTitle}</h1>
            <p>{error || 'Unable to load dashboard data.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>{headerTitle}</h1>
          <p>Welcome back! Here's what's happening with your digital signage.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card playlist-card">
          <div className="card-accent"></div>
          <div className="stat-card-inner">
            <div className="stat-icon playlist-icon">
              <PlaylistIcon />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Playlists</div>
              <div className="stat-value">{stats.playlists.total}</div>
              <div className="stat-detail">
                <span className="stat-badge active">{stats.playlists.active} active</span>
                <span className="stat-badge inactive">{stats.playlists.inactive} inactive</span>
              </div>
              <div className="stat-trend up">
                <TrendUpIcon /> +12% this week
              </div>
            </div>
          </div>
        </div>

        <div className="stat-card device-card">
          <div className="card-accent"></div>
          <div className="stat-card-inner">
            <div className="stat-icon device-icon">
              <DeviceIcon />
            </div>
            <div className="stat-content">
              <div className="stat-label">Total Devices</div>
              <div className="stat-value">{stats.devices.total}</div>
              <div className="stat-detail">
                <span className="stat-badge online">{stats.devices.online} online</span>
                <span className="stat-badge offline">{stats.devices.offline} offline</span>
              </div>
              <div className="stat-trend up">
                <TrendUpIcon /> 75% uptime
              </div>
            </div>
          </div>
        </div>

        <div className="stat-card schedule-card">
          <div className="card-accent"></div>
          <div className="stat-card-inner">
            <div className="stat-icon schedule-icon">
              <ScheduleIcon />
            </div>
            <div className="stat-content">
              <div className="stat-label">Active Schedules</div>
              <div className="stat-value">{stats.schedules.active}</div>
              <div className="stat-detail">
                <span className="stat-badge upcoming">{stats.schedules.upcoming} upcoming</span>
                <span className="stat-badge completed">{stats.schedules.completed} done</span>
              </div>
              <div className="stat-trend up">
                <TrendUpIcon /> +5 this month
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="dashboard-content">
        <div className="content-section">
          <div className="section-header">
            <div className="section-title">
              <div className="section-icon playlist">
                <SmallPlaylistIcon />
              </div>
              <h2>Recent Playlists</h2>
            </div>
            <button
              className="view-all-btn"
              onClick={() => navigate('/playlists')}
            >
              View All <ArrowIcon />
            </button>
          </div>
          <div className="playlist-list">
            {recentPlaylists.map(playlist => (
              <div key={playlist.id} className="playlist-item">
                <div className="playlist-info">
                  <div className="item-icon playlist">
                    <SmallPlaylistIcon />
                  </div>
                  <div className="item-details">
                    <div className="playlist-name">{playlist.name}</div>
                   
                  </div>
                </div>
                <div className={`playlist-status ${playlist.status}`}>
                  {playlist.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="content-section">
          <div className="section-header">
            <div className="section-title">
              <div className="section-icon device">
                <SmallDeviceIcon />
              </div>
              <h2>Active Devices</h2>
            </div>
            <button
              className="view-all-btn"
              onClick={() => navigate('/devices')}
            >
              View All <ArrowIcon />
            </button>
          </div>
          <div className="device-list">
            {activeDevices.map(device => (
              <div key={device.id} className="device-item">
                <div className="device-info">
                  <div className="item-icon device">
                    <SmallDeviceIcon />
                  </div>
                  <div className="item-details">
                    <div className="device-name">{device.name}</div>
                    <div className="device-playlist">{device.playlist}</div>
                  </div>
                </div>
                <div className={`device-status ${device.status}`}>
                  <span className="status-dot"></span>
                  {device.status}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="content-section">
          <div className="section-header">
            <div className="section-title">
              <div className="section-icon schedule">
                <SmallScheduleIcon />
              </div>
              <h2>Active Schedules</h2>
            </div>
            <button
              className="view-all-btn"
              onClick={() => navigate('/playlists')}
            >
              View All <ArrowIcon />
            </button>
          </div>
          <div className="schedule-list">
            {activeSchedules.map(schedule => (
              <div key={schedule.id} className="schedule-item">
                <div className="schedule-info">
                  <div className="item-icon schedule">
                    <SmallScheduleIcon />
                  </div>
                  <div className="item-details">
                    <div className="schedule-playlist">{schedule.playlist}</div>
                    <div className="schedule-meta">
                      <span>
                        {formatLocalDateTime(schedule.startTime)}
                        {schedule.endTime ? ` - ${formatLocalDateTime(schedule.endTime)}` : ""}
                      </span>
                    </div>
                  </div>
                </div>
                {/* <div className={`schedule-status ${schedule.status}`}>
                  {schedule.status}
                </div> */}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

