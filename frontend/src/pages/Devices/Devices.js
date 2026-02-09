import './Devices.css';
import { useState, useEffect } from 'react';
import { deviceAPI, playlistAPI, deviceGroupAPI } from '../../services/api';

function Devices() {
  const [devices, setDevices] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [showDeviceKey, setShowDeviceKey] = useState(false);

  useEffect(() => {
    fetchDevices();
    fetchPlaylists();
    fetchGroups();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await deviceAPI.getDevices();
      setDevices(response.devices || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylists = async () => {
    try {
      const response = await playlistAPI.getPlaylists();
      setPlaylists(response.playlists || []);
    } catch (err) {
      console.error('Failed to fetch playlists:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await deviceGroupAPI.getGroups();
      const groupsList = response.groups || [];
      setGroups(groupsList);
      // Set default to "All devices" group (global group with user_id === null)
      const allDevicesGroup = groupsList.find(g => g.name === 'All devices' && g.user_id === null);
      if (allDevicesGroup) {
        setSelectedGroupId(allDevicesGroup.id.toString());
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  };

  const handleCreateDevice = async (e) => {
    e.preventDefault();
    if (!newDeviceName.trim()) {
      setError('Device name is required');
      return;
    }
    if (!selectedGroupId) {
      setError('Group is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await deviceAPI.createDevice(newDeviceName.trim(), parseInt(selectedGroupId));
      setNewDeviceName('');
      setShowCreateModal(false);
      fetchDevices();
      // Select the newly created device to show the key
      setSelectedDevice(response.device);
      setShowDeviceKey(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create device');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!window.confirm('Are you sure you want to delete this device?')) {
      return;
    }

    try {
      setLoading(true);
      await deviceAPI.deleteDevice(id);
      if (selectedDevice?.id === id) {
        setSelectedDevice(null);
      }
      fetchDevices();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete device');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignPlaylist = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');
      await deviceAPI.assignPlaylist(
        selectedDevice.id,
        selectedPlaylistId ? parseInt(selectedPlaylistId) : null
      );
      setShowPlaylistModal(false);
      setSelectedPlaylistId('');
      fetchDevices();
      // Refresh selected device
      const response = await deviceAPI.getDevice(selectedDevice.id);
      setSelectedDevice(response.device);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDeviceKey = async () => {
    if (selectedDevice?.device_key) {
      try {
        await navigator.clipboard.writeText(selectedDevice.device_key);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const selectDevice = (device) => {
    setSelectedDevice(device);
    setShowDeviceKey(false);
    setCopiedKey(false);
  };

  const maskDeviceKey = (key) => {
    if (!key) return '';
    return '••••••';
  };

  return (
    <div className="devices-page">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>Devices</h1>
            <p>Manage your digital signage devices</p>
          </div>
          <button 
            className="create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Device
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="devices-container">
        <div className="devices-list">
          <h2>Your Devices</h2>
          {loading && !selectedDevice ? (
            <div className="loading">Loading devices...</div>
          ) : devices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <p>No devices yet. Add your first device to get started!</p>
            </div>
          ) : (
            <div className="device-cards">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className={`device-card ${selectedDevice?.id === device.id ? 'active' : ''}`}
                  onClick={() => selectDevice(device)}
                >
                  <div className="device-card-header">
                    <div className="device-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    </div>
                    <button
                      className="delete-btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDevice(device.id);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                  <h3>{device.name}</h3>
                  <div className="device-meta">
                    <span className={`status-badge ${device.is_online ? 'online' : 'offline'}`}>
                      <span className="status-dot"></span>
                      {device.is_online ? 'Online' : 'Offline'}
                    </span>
                    {device.group_name && (
                      <>
                        <span className="meta-separator">•</span>
                        <span className="playlist-badge">{device.group_name}</span>
                      </>
                    )}
                    {device.playlist_name && (
                      <>
                        <span className="meta-separator">•</span>
                        <span className="playlist-badge">{device.playlist_name}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="device-detail">
          {selectedDevice ? (
            <>
              <div className="detail-header">
                <div className="detail-title-row">
                  <div className="detail-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div>
                    <h2>{selectedDevice.name}</h2>
                    <span className={`status-indicator ${selectedDevice.is_online ? 'online' : 'offline'}`}>
                      <span className="status-dot"></span>
                      {selectedDevice.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-content">
                <div className="detail-section">
                  <h3>Device Key</h3>
                  <p className="section-description">Use this key to connect your display device</p>
                  <div className="device-key-container">
                    <div className="device-key-display">
                      <code>{showDeviceKey ? selectedDevice.device_key : maskDeviceKey(selectedDevice.device_key)}</code>
                      <div className="key-actions">
                        <button 
                          className="key-toggle-btn"
                          onClick={() => setShowDeviceKey(!showDeviceKey)}
                          title={showDeviceKey ? 'Hide key' : 'Show key'}
                        >
                          {showDeviceKey ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                              <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          )}
                        </button>
                        <button 
                          className={`copy-btn ${copiedKey ? 'copied' : ''}`}
                          onClick={handleCopyDeviceKey}
                        >
                          {copiedKey ? (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                              Copy Key
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Assigned Playlist</h3>
                  <p className="section-description">Content that will be displayed on this device</p>
                  <div className="playlist-assignment">
                    {selectedDevice.playlist_name ? (
                      <div className="assigned-playlist">
                        <div className="playlist-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                          </svg>
                        </div>
                        <div className="playlist-info">
                          <span className="playlist-name">{selectedDevice.playlist_name}</span>
                          <span className={`playlist-status ${selectedDevice.playlist_status || 'inactive'}`}>
                            {selectedDevice.playlist_status || 'inactive'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="no-playlist">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <span>No playlist assigned</span>
                      </div>
                    )}
                    <button 
                      className="change-playlist-btn"
                      onClick={() => {
                        setSelectedPlaylistId(selectedDevice.active_playlist_id?.toString() || '');
                        setShowPlaylistModal(true);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      {selectedDevice.playlist_name ? 'Change Playlist' : 'Assign Playlist'}
                    </button>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Device Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Device ID</span>
                      <span className="info-value">{selectedDevice.id}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Group</span>
                      <span className="info-value">{selectedDevice.group_name || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Created</span>
                      <span className="info-value">{new Date(selectedDevice.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Last Updated</span>
                      <span className="info-value">{new Date(selectedDevice.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="danger-zone">
                  <h3>Danger Zone</h3>
                  <p>Permanently delete this device and remove it from your account.</p>
                  <button 
                    className="delete-device-btn"
                    onClick={() => handleDeleteDevice(selectedDevice.id)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Delete Device
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-detail">
              <div className="empty-detail-content">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <p>Select a device to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Device Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Device</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateDevice}>
              <div className="form-group">
                <label>Device Name *</label>
                <input
                  type="text"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  placeholder="e.g., Store Front Display"
                  required
                  autoFocus
                />
                <small>Give your device a descriptive name to easily identify it</small>
              </div>
              <div className="form-group">
                <label>Group *</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="playlist-select"
                  required
                >
                  <option value="">Select a group</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name} {group.user_id === null ? '(Global)' : ''}
                    </option>
                  ))}
                </select>
                <small>Select which group this device belongs to</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Playlist Modal */}
      {showPlaylistModal && selectedDevice && (
        <div className="modal-overlay" onClick={() => setShowPlaylistModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Playlist</h2>
              <button className="close-btn" onClick={() => setShowPlaylistModal(false)}>×</button>
            </div>
            <form onSubmit={handleAssignPlaylist}>
              <div className="form-group">
                <label>Select Playlist</label>
                <select
                  value={selectedPlaylistId}
                  onChange={(e) => setSelectedPlaylistId(e.target.value)}
                  className="playlist-select"
                >
                  <option value="">No playlist (unassign)</option>
                  {playlists.map(playlist => (
                    <option key={playlist.id} value={playlist.id}>
                      {playlist.name} {playlist.status === 'active' ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
                <small>Choose which playlist to display on this device</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowPlaylistModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Devices;
