import './Playlists.css';
import { useState, useEffect } from 'react';
import { playlistAPI, deviceGroupAPI, getFileUrl } from '../../services/api';

function Playlists() {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState({ name: '', description: '' });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDuration, setUploadDuration] = useState(5);
  const [error, setError] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [deviceGroups, setDeviceGroups] = useState([]);
  const [selectedDeviceGroupId, setSelectedDeviceGroupId] = useState('');
  const [scheduleData, setScheduleData] = useState({
    start_time: '',
    end_time: '',
    device_group_id: ''
  });

  useEffect(() => {
    fetchPlaylists();
    fetchDeviceGroups();
  }, []);

  const fetchDeviceGroups = async () => {
    try {
      const response = await deviceGroupAPI.getGroups();
      setDeviceGroups(response.groups || []);
    } catch (err) {
      console.error('Failed to fetch device groups:', err);
    }
  };

  const fetchPlaylists = async () => {
    try {
      setLoading(true);
      const response = await playlistAPI.getPlaylists();
      setPlaylists(response.playlists || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch playlists');
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylistDetails = async (id) => {
    try {
      setLoading(true);
      const response = await playlistAPI.getPlaylist(id);
      setSelectedPlaylist(response.playlist);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch playlist details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylist.name.trim()) {
      setError('Playlist name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await playlistAPI.createPlaylist(newPlaylist.name, newPlaylist.description);
      setNewPlaylist({ name: '', description: '' });
      setShowCreateModal(false);
      fetchPlaylists();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlaylist = async (id) => {
    if (!window.confirm('Are you sure you want to delete this playlist?')) {
      return;
    }

    try {
      setLoading(true);
      await playlistAPI.deletePlaylist(id);
      if (selectedPlaylist?.id === id) {
        setSelectedPlaylist(null);
      }
      fetchPlaylists();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadFile = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      setError('Please select a file');
      return;
    }

    try {
      setUploading(true);
      setError('');
      await playlistAPI.uploadFile(selectedPlaylist.id, uploadFile, uploadDuration);
      setUploadFile(null);
      setUploadDuration(5);
      setShowUploadModal(false);
      fetchPlaylistDetails(selectedPlaylist.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to remove this item from the playlist?')) {
      return;
    }

    try {
      setLoading(true);
      await playlistAPI.deleteItem(itemId);
      fetchPlaylistDetails(selectedPlaylist.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete item');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDuration = async (itemId, duration) => {
    if (duration < 1) {
      setError('Duration must be at least 1 second');
      return;
    }

    try {
      setLoading(true);
      await playlistAPI.updateItemDuration(itemId, duration);
      fetchPlaylistDetails(selectedPlaylist.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update duration');
    } finally {
      setLoading(false);
    }
  };

  const handleReorderItem = async (itemId, direction) => {
    try {
      setLoading(true);
      await playlistAPI.updateItemOrder(itemId, direction);
      fetchPlaylistDetails(selectedPlaylist.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reorder item');
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (e) => {
    e.preventDefault();
    if (!selectedDeviceGroupId) {
      setError('Please select a device group');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await playlistAPI.setPlaylistActive(selectedPlaylist.id, parseInt(selectedDeviceGroupId));
      setSelectedDeviceGroupId('');
      setShowActivateModal(false);
      fetchPlaylists();
      fetchPlaylistDetails(selectedPlaylist.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set playlist active');
    } finally {
      setLoading(false);
    }
  };

  const handleSetInactive = async (playlistId) => {
    try {
      setLoading(true);
      setError('');
      await playlistAPI.setPlaylistInactive(playlistId);
      fetchPlaylists();
      fetchPlaylistDetails(playlistId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to deactivate playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePlaylist = async (e) => {
    e.preventDefault();
    if (!scheduleData.start_time) {
      setError('Start time is required');
      return;
    }

    if (!scheduleData.device_group_id) {
      setError('Device group is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await playlistAPI.schedulePlaylist(
        selectedPlaylist.id,
        scheduleData.start_time,
        scheduleData.end_time || null,
        parseInt(scheduleData.device_group_id)
      );
      setScheduleData({ start_time: '', end_time: '', device_group_id: '' });
      setShowScheduleModal(false);
      fetchPlaylists();
      fetchPlaylistDetails(selectedPlaylist.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule playlist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="playlists-page">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>Playlists</h1>
            <p>Manage your digital signage playlists</p>
          </div>
          <button 
            className="create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create Playlist
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="playlists-container">
        <div className="playlists-list">
          <h2>Your Playlists</h2>
          {loading && !selectedPlaylist ? (
            <div className="loading">Loading playlists...</div>
          ) : playlists.length === 0 ? (
            <div className="empty-state">
              <p>No playlists yet. Create your first playlist to get started!</p>
            </div>
          ) : (
            <div className="playlist-cards">
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className={`playlist-card ${selectedPlaylist?.id === playlist.id ? 'active' : ''}`}
                  onClick={() => fetchPlaylistDetails(playlist.id)}
                >
                  <div className="playlist-card-header">
                    <h3>{playlist.name}</h3>
                    <button
                      className="delete-btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePlaylist(playlist.id);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                  <p className="playlist-description">{playlist.description || 'No description'}</p>
                  <div className="playlist-meta">
                    <span>{playlist.item_count || 0} items</span>
                    <span className="meta-separator">•</span>
                    <span>Created {new Date(playlist.created_at).toLocaleDateString()}</span>
                    {playlist.status === 'active' && playlist.device_group_name && (
                      <>
                        <span className="meta-separator">•</span>
                        <span className="device-group-badge">Active: {playlist.device_group_name}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="playlist-detail">
          {selectedPlaylist ? (
            <>
              <div className="detail-header">
                <div>
                  <h2>{selectedPlaylist.name}</h2>
                  <p>{selectedPlaylist.description || 'No description'}</p>
                  <div className="playlist-status-badge">
                    <span className={`status-indicator ${selectedPlaylist.status || 'inactive'}`}>
                      {selectedPlaylist.status || 'inactive'}
                    </span>
                    {selectedPlaylist.status === 'active' && selectedPlaylist.device_group_name && (
                      <span className="device-group-info">
                        Active for: {selectedPlaylist.device_group_name}
                      </span>
                    )}
                    {selectedPlaylist.schedule_start && (
                      <span className="schedule-info">
                        Scheduled: {new Date(selectedPlaylist.schedule_start).toLocaleString()}
                        {selectedPlaylist.schedule_end && ` - ${new Date(selectedPlaylist.schedule_end).toLocaleString()}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="header-actions">
                  <div className="playlist-controls">
                    <button
                      className={`control-btn ${selectedPlaylist.status === 'active' ? 'active' : ''}`}
                      onClick={() => setShowActivateModal(true)}
                      disabled={selectedPlaylist.status === 'active'}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      {selectedPlaylist.status === 'active' ? 'Active' : 'Set Active'}
                    </button>
                    <button
                      className="control-btn schedule-btn"
                      onClick={() => setShowScheduleModal(true)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      Schedule
                    </button>
                    {selectedPlaylist.status !== 'inactive' && (
                      <button
                        className="control-btn deactivate-btn"
                        onClick={() => handleSetInactive(selectedPlaylist.id)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                        </svg>
                        Deactivate
                      </button>
                    )}
                  </div>
                  <button
                    className="upload-btn"
                    onClick={() => setShowUploadModal(true)}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    Upload File
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="loading">Loading items...</div>
              ) : selectedPlaylist.items && selectedPlaylist.items.length > 0 ? (
                <div className="playlist-items">
                  {selectedPlaylist.items.map((item, index) => (
                    <div key={item.id} className="playlist-item-card">
                      <div className="item-preview">
                        {item.file_type === 'image' ? (
                          <img
                            src={getFileUrl(item.file_path)}
                            alt={item.original_name}
                            onError={(e) => {
                              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="14" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle"%3EImage%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        ) : (
                          <div className="video-placeholder">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="item-info">
                        <div className="item-name">{item.original_name}</div>
                        <div className="item-details">
                          <span>Order: {item.display_order}</span>
                          {item.file_type === 'image' && (
                            <>
                              <span className="meta-separator">•</span>
                              <span>Duration: {item.duration}s</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="item-actions">
                        {item.file_type === 'image' && (
                          <div className="duration-control">
                            <label>Duration (s):</label>
                            <input
                              type="number"
                              min="1"
                              value={item.duration || 5}
                              onChange={(e) => {
                                const newDuration = parseInt(e.target.value);
                                if (newDuration >= 1) {
                                  handleUpdateDuration(item.id, newDuration);
                                }
                              }}
                              className="duration-input"
                            />
                          </div>
                        )}
                        <div className="order-controls">
                          <button
                            className="order-btn"
                            onClick={() => handleReorderItem(item.id, 'up')}
                            disabled={index === 0}
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            className="order-btn"
                            onClick={() => handleReorderItem(item.id, 'down')}
                            disabled={index === selectedPlaylist.items.length - 1}
                            title="Move down"
                          >
                            ↓
                          </button>
                        </div>
                        <button
                          className="delete-item-btn"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p>No items in this playlist. Upload files to get started!</p>
                </div>
              )}
            </>
          ) : (
            <div className="empty-detail">
              <p>Select a playlist to view and manage its items</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Playlist</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreatePlaylist}>
              <div className="form-group">
                <label>Playlist Name *</label>
                <input
                  type="text"
                  value={newPlaylist.name}
                  onChange={(e) => setNewPlaylist({ ...newPlaylist, name: e.target.value })}
                  placeholder="Enter playlist name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newPlaylist.description}
                  onChange={(e) => setNewPlaylist({ ...newPlaylist, description: e.target.value })}
                  placeholder="Enter playlist description (optional)"
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Playlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {showUploadModal && selectedPlaylist && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload File to Playlist</h2>
              <button className="close-btn" onClick={() => setShowUploadModal(false)}>×</button>
            </div>
            <form onSubmit={handleUploadFile}>
              <div className="form-group">
                <label>Select File *</label>
                <div className="file-upload-area">
                  <input
                    type="file"
                    id="file-upload"
                    accept="image/*,video/*"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="file-input"
                  />
                  <label htmlFor="file-upload" className="file-upload-label">
                    {uploadFile ? uploadFile.name : 'Choose file or drag and drop'}
                  </label>
                </div>
                {uploadFile && (
                  <div className="file-info">
                    <span>File: {uploadFile.name}</span>
                    <span>Size: {(uploadFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                )}
              </div>
              {uploadFile && uploadFile.type.startsWith('image/') && (
                <div className="form-group">
                  <label>Duration (seconds) *</label>
                  <input
                    type="number"
                    min="1"
                    value={uploadDuration}
                    onChange={(e) => setUploadDuration(parseInt(e.target.value) || 5)}
                    placeholder="5"
                  />
                  <small>How long to display this image (minimum 1 second)</small>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={uploading || !uploadFile}>
                  {uploading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Active Modal */}
      {showActivateModal && selectedPlaylist && (
        <div className="modal-overlay" onClick={() => setShowActivateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Set Playlist Active</h2>
              <button className="close-btn" onClick={() => setShowActivateModal(false)}>×</button>
            </div>
            <form onSubmit={handleSetActive}>
              <div className="form-group">
                <label>Device Group *</label>
                <select
                  value={selectedDeviceGroupId}
                  onChange={(e) => setSelectedDeviceGroupId(e.target.value)}
                  required
                >
                  <option value="">Select a device group</option>
                  {deviceGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} {group.device_count > 0 && `(${group.device_count} devices)`}
                    </option>
                  ))}
                </select>
                <small>Select the device group to activate this playlist for</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowActivateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Activating...' : 'Set Active'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Playlist Modal */}
      {showScheduleModal && selectedPlaylist && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Schedule Playlist</h2>
              <button className="close-btn" onClick={() => setShowScheduleModal(false)}>×</button>
            </div>
            <form onSubmit={handleSchedulePlaylist}>
              <div className="form-group">
                <label>Device Group *</label>
                <select
                  value={scheduleData.device_group_id}
                  onChange={(e) => setScheduleData({ ...scheduleData, device_group_id: e.target.value })}
                  required
                >
                  <option value="">Select a device group</option>
                  {deviceGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} {group.device_count > 0 && `(${group.device_count} devices)`}
                    </option>
                  ))}
                </select>
                <small>Select the device group to schedule this playlist for</small>
              </div>
              <div className="form-group">
                <label>Start Time *</label>
                <input
                  type="datetime-local"
                  value={scheduleData.start_time}
                  onChange={(e) => setScheduleData({ ...scheduleData, start_time: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>End Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={scheduleData.end_time}
                  onChange={(e) => setScheduleData({ ...scheduleData, end_time: e.target.value })}
                />
                <small>Leave empty for no end time</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Scheduling...' : 'Schedule Playlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Playlists;
