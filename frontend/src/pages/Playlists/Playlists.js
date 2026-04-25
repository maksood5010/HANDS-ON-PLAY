import './Playlists.css';
import { useState, useEffect, useCallback, memo } from 'react';
import { playlistAPI, deviceGroupAPI, getFileUrl } from '../../services/api';

const SchedulePlaylistModal = memo(function SchedulePlaylistModal({
  selectedPlaylist,
  deviceGroups,
  playlistSchedules,
  loading,
  openNativePicker,
  formatTime12h,
  onClose,
  onSubmit,
  onToggleSchedule,
  onDeleteSchedule,
}) {
  const [form, setForm] = useState({
    mode: 'one_time',
    start_time: '',
    end_time: '',
    daily_start_time: '',
    daily_end_time: '',
    device_group_id: '',
  });

  useEffect(() => {
    // Reset when opening for a playlist
    setForm({
      mode: 'one_time',
      start_time: '',
      end_time: '',
      daily_start_time: '',
      daily_end_time: '',
      device_group_id: '',
    });
  }, [selectedPlaylist?.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Schedule Playlist</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
        >
          <div className="form-group">
            <label>Schedule Type *</label>
            <select
              value={form.mode}
              onChange={(e) => setForm((p) => ({ ...p, mode: e.target.value }))}
              required
            >
              <option value="one_time">One-time (start/end)</option>
              <option value="daily">Daily repeating (Asia/Dubai)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Device Group *</label>
            <select
              value={form.device_group_id}
              onChange={(e) => setForm((p) => ({ ...p, device_group_id: e.target.value }))}
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

          {form.mode === 'daily' ? (
            <>
              <div className="form-group">
                <label>Daily Start Time *</label>
                <input
                  type="time"
                  value={form.daily_start_time}
                  onChange={(e) => setForm((p) => ({ ...p, daily_start_time: e.target.value }))}
                  onClick={openNativePicker}
                  required
                />
              </div>
              <div className="form-group">
                <label>Daily End Time *</label>
                <input
                  type="time"
                  value={form.daily_end_time}
                  onChange={(e) => setForm((p) => ({ ...p, daily_end_time: e.target.value }))}
                  onClick={openNativePicker}
                  required
                />
                <small>Timezone: Asia/Dubai (UAE)</small>
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Start Time *</label>
                <input
                  type="datetime-local"
                  value={form.start_time}
                  onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                  onClick={openNativePicker}
                  required
                />
              </div>
              <div className="form-group">
                <label>End Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={form.end_time}
                  onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                  onClick={openNativePicker}
                />
                <small>Leave empty for no end time</small>
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule Playlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

function Playlists() {
  const formatTime12h = (timeValue) => {
    if (!timeValue) return '';

    // pg TIME may come as "HH:MM:SS(.ffffff)"
    if (typeof timeValue === 'string') {
      const [hhRaw, mmRaw] = timeValue.split(':');
      const hh = Number.parseInt(hhRaw, 10);
      const mm = Number.parseInt(mmRaw, 10);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return timeValue;

      const suffix = hh >= 12 ? 'PM' : 'AM';
      const hh12 = ((hh + 11) % 12) + 1;
      const mm2 = String(mm).padStart(2, '0');
      return `${hh12}:${mm2} ${suffix}`;
    }
    return String(timeValue);
  };

  const openNativePicker = (e) => {
    // `showPicker()` requires a trusted user gesture; `onFocus` can be non-user initiated.
    if (!e?.isTrusted) return;
    const el = e.currentTarget;
    if (!el?.showPicker) return;
    try {
      el.showPicker();
    } catch {
      // Ignore gesture errors; user can still use the icon/default behavior.
    }
  };

  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPlaylist, setNewPlaylist] = useState({ name: '', description: '' });
  // Multi-file upload: array of { file, duration }
  const [uploadFiles, setUploadFiles] = useState([]);
  const [error, setError] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [deviceGroups, setDeviceGroups] = useState([]);
  const [selectedDeviceGroupId, setSelectedDeviceGroupId] = useState('');
  const [playlistSchedules, setPlaylistSchedules] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);

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
      const schedulesResp = await playlistAPI.listSchedules({ playlistId: id });
      setPlaylistSchedules(schedulesResp.schedules || []);
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
    if (!uploadFiles.length) {
      setError('Please select at least one file');
      return;
    }

    // Validate durations for images
    for (const entry of uploadFiles) {
      if (entry.file.type.startsWith('image/')) {
        const d = entry.duration;
        if (!d || d < 1) {
          setError('Duration for each image must be at least 1 second');
          return;
        }
      }
    }

    try {
      setUploading(true);
      setError('');
      const files = uploadFiles.map((entry) => entry.file);
      const durations = uploadFiles.map((entry) =>
        entry.file.type.startsWith('image/') ? entry.duration : null
      );
      await playlistAPI.uploadFiles(selectedPlaylist.id, files, durations);
      setUploadFiles([]);
      setShowUploadModal(false);
      fetchPlaylistDetails(selectedPlaylist.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelected = (filesList) => {
    if (!filesList || !filesList.length) return;
    setError('');

    const newEntries = Array.from(filesList).map((file) => ({
      file,
      // Default duration: 5s for images, null for videos
      duration: file.type.startsWith('image/') ? 5 : null,
    }));

    setUploadFiles((prev) => [...prev, ...newEntries]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    handleFileSelected(files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
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

  const handleSchedulePlaylist = useCallback(async (form) => {
    if (!form?.device_group_id) {
      setError('Device group is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      if (form.mode === 'daily') {
        if (!form.daily_start_time || !form.daily_end_time) {
          setError('Daily start and end time are required');
          return;
        }
        await playlistAPI.createDailySchedule(
          selectedPlaylist.id,
          parseInt(form.device_group_id),
          form.daily_start_time,
          form.daily_end_time,
          true
        );
      } else {
        if (!form.start_time) {
          setError('Start time is required');
          return;
        }
        await playlistAPI.schedulePlaylist(
          selectedPlaylist.id,
          form.start_time,
          form.end_time || null,
          parseInt(form.device_group_id)
        );
      }

      setShowScheduleModal(false);
      fetchPlaylists();
      fetchPlaylistDetails(selectedPlaylist.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to schedule playlist');
    } finally {
      setLoading(false);
    }
  }, [selectedPlaylist?.id]);

  const handleDeleteSchedule = useCallback(async (scheduleId) => {
    if (!window.confirm('Delete this schedule?')) return;
    try {
      setLoading(true);
      setError('');
      await playlistAPI.deleteSchedule(scheduleId);
      const schedulesResp = await playlistAPI.listSchedules({ playlistId: selectedPlaylist.id });
      setPlaylistSchedules(schedulesResp.schedules || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete schedule');
    } finally {
      setLoading(false);
    }
  }, [selectedPlaylist?.id]);

  const handleClearOneTimeSchedule = useCallback(async (playlistId) => {
    if (!window.confirm('Clear the one-time schedule for this playlist?')) return;
    try {
      setLoading(true);
      setError('');
      const resp = await playlistAPI.clearOneTimeSchedule(playlistId);
      if (resp?.playlist) {
        setSelectedPlaylist((p) => (p?.id === playlistId ? { ...p, ...resp.playlist } : p));
      }
      fetchPlaylists();
      fetchPlaylistDetails(playlistId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to clear schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleSchedule = useCallback(async (schedule) => {
    try {
      setLoading(true);
      setError('');
      await playlistAPI.updateSchedule(schedule.id, { enabled: !schedule.enabled });
      const schedulesResp = await playlistAPI.listSchedules({ playlistId: selectedPlaylist.id });
      setPlaylistSchedules(schedulesResp.schedules || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update schedule');
    } finally {
      setLoading(false);
    }
  }, [selectedPlaylist?.id]);

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
                    {selectedPlaylist.device_group_name && (
                      <span className="device-group-info">
                        Group: {selectedPlaylist.device_group_name}
                      </span>
                    )}

                    {/* Schedules */}
                    {(() => {
                      const hasOneTime = Boolean(selectedPlaylist.schedule_start);
                      const recurring = (playlistSchedules || []).filter((s) => s.type === 'daily');
                      const hasAny = hasOneTime || recurring.length > 0;

                      if (!hasAny) {
                        return <span className="schedule-empty">No schedules configured</span>;
                      }

                      return (
                        <>
                          {hasOneTime && (
                            <span className="schedule-info-row">
                              <span className="schedule-info">
                                One-time: {new Date(selectedPlaylist.schedule_start).toLocaleString()}
                                {selectedPlaylist.schedule_end &&
                                  ` - ${new Date(selectedPlaylist.schedule_end).toLocaleString()}`}
                              </span>
                              <button
                                type="button"
                                className="schedule-delete-btn"
                                onClick={() => handleClearOneTimeSchedule(selectedPlaylist.id)}
                                title="Clear one-time schedule"
                                aria-label="Clear one-time schedule"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </button>
                            </span>
                          )}

                          {recurring.map((s) => (
                            <span key={s.id} className="schedule-info-row">
                              <span className="schedule-info">
                                Daily: {formatTime12h(s.daily_start_time)} - {formatTime12h(s.daily_end_time)}
                                {s.timezone ? ` (${s.timezone})` : ''}
                                {s.device_group_name ? ` • ${s.device_group_name}` : ''}
                                {s.enabled === false ? ' • disabled' : ''}
                              </span>
                              <button
                                type="button"
                                className="schedule-delete-btn"
                                onClick={() => handleDeleteSchedule(s.id)}
                                title="Delete schedule"
                                aria-label="Delete schedule"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </button>
                            </span>
                          ))}
                        </>
                      );
                    })()}
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
                <div
                  className={`file-upload-area ${isDragOver ? 'drag-over' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="file-upload"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => handleFileSelected(e.target.files)}
                    className="file-input"
                  />
                  <label htmlFor="file-upload" className="file-upload-label">
                    {uploadFiles.length > 0
                      ? `${uploadFiles.length} file${uploadFiles.length > 1 ? 's' : ''} selected`
                      : 'Choose files or drag and drop'}
                  </label>
                </div>
                {uploadFiles.length > 0 && (
                  <div className="file-info multi-file-list">
                    <ul>
                      {uploadFiles.map((entry, index) => (
                        <li key={index}>
                          <span className="file-name">{entry.file.name}</span>
                          <span className="file-size">
                            {(entry.file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                          {entry.file.type.startsWith('image/') && (
                            <span className="file-duration">
                              Duration (s):{' '}
                              <input
                                type="number"
                                min="1"
                                value={entry.duration ?? 5}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value, 10);
                                  setUploadFiles((prev) =>
                                    prev.map((item, i) =>
                                      i === index
                                        ? {
                                            ...item,
                                            duration:
                                              Number.isNaN(value) || value < 1 ? 1 : value,
                                          }
                                        : item
                                    )
                                  );
                                }}
                              />
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="modal-actions">

              <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setUploadFiles([])}
                  disabled={uploading || uploadFiles.length === 0}
                >
                  Clear Files
                </button>
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={uploading || uploadFiles.length === 0}>
                  {uploading ? 'Uploading...' : 'Upload Files'}
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
        <SchedulePlaylistModal
          selectedPlaylist={selectedPlaylist}
          deviceGroups={deviceGroups}
          playlistSchedules={playlistSchedules}
          loading={loading}
          openNativePicker={openNativePicker}
          formatTime12h={formatTime12h}
          onClose={() => setShowScheduleModal(false)}
          onSubmit={handleSchedulePlaylist}
          onToggleSchedule={handleToggleSchedule}
          onDeleteSchedule={handleDeleteSchedule}
        />
      )}
    </div>
  );
}

export default Playlists;
