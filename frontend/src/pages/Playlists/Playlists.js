import './Playlists.css';
import { useState, useEffect, useCallback, memo, useRef, useId, useContext } from 'react';
import { playlistAPI, deviceGroupAPI, getFileUrl } from '../../services/api';
import Sheet from '../../components/common/Sheet/Sheet';
import ConfirmSheet from '../../components/common/ConfirmSheet/ConfirmSheet';
import { useIsMobile } from '../../hooks/useIsMobile';
import { LayoutTopBarActionContext } from '../../components/Layout/LayoutTopBarActionContext';

const SchedulePlaylistModal = memo(function SchedulePlaylistModal({
  selectedPlaylist,
  deviceGroups,
  playlistSchedules: _playlistSchedules,
  loading,
  openNativePicker,
  formatTime12h: _formatTime12h,
  onClose,
  onSubmit,
  onToggleSchedule: _onToggleSchedule,
  onDeleteSchedule: _onDeleteSchedule,
}) {
  const formId = useId();
  const useSheetLayout = useIsMobile(640);
  const [form, setForm] = useState({
    mode: 'daily',
    start_time: '',
    end_time: '',
    daily_start_time: '',
    daily_end_time: '',
    device_group_id: '',
  });

  useEffect(() => {
    // Reset when opening for a playlist
    setForm({
      mode: 'daily',
      start_time: '',
      end_time: '',
      daily_start_time: '',
      daily_end_time: '',
      device_group_id: '',
    });
  }, [selectedPlaylist?.id]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const formFields = (
    <>
      <div className="form-group">
        <label>Schedule Type *</label>
        <select
          value={form.mode}
          onChange={(e) => setForm((p) => ({ ...p, mode: e.target.value }))}
          required
        >
          <option value="one_time">One-time (start/end)</option>
          <option value="forever">Forever (optional start)</option>
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
      ) : form.mode === 'forever' ? (
        <>
          <div className="form-group">
            <label>Start Time (Optional)</label>
            <input
              type="datetime-local"
              value={form.start_time}
              onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
              onClick={openNativePicker}
            />
            <small>Leave empty to start immediately</small>
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
            <label>End Time *</label>
            <input
              type="datetime-local"
              value={form.end_time}
              onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
              onClick={openNativePicker}
              required
            />
            <small>Required for one-time schedules</small>
          </div>
        </>
      )}
    </>
  );

  const footer = (
    <div className="modal-actions schedule-modal-footer">
      <button type="button" className="cancel-btn" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" form={formId} className="submit-btn" disabled={loading}>
        {loading ? 'Scheduling...' : 'Schedule Playlist'}
      </button>
    </div>
  );

  if (useSheetLayout) {
    return (
      <Sheet open title="Schedule Playlist" onClose={onClose} footer={footer} maxWidth="560px">
        <form id={formId} className="schedule-playlist-form" onSubmit={handleFormSubmit}>
          {formFields}
        </form>
      </Sheet>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Schedule Playlist</h2>
          <button type="button" className="close-btn" onClick={onClose}>×</button>
        </div>
        <form className="schedule-playlist-form" onSubmit={handleFormSubmit}>
          {formFields}
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
  const MAX_UPLOAD_FILES = 25;
  const statusClass = (status) => String(status || 'inactive').trim().toLowerCase();
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newPlaylist, setNewPlaylist] = useState({ name: '', description: '' });
  // Multi-file upload: array of { file, duration }
  const [uploadFiles, setUploadFiles] = useState([]);
  const uploadPreviewUrlsRef = useRef(new Set());
  const [error, setError] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [deviceGroups, setDeviceGroups] = useState([]);
  const [selectedDeviceGroupId, setSelectedDeviceGroupId] = useState('');
  const [playlistSchedules, setPlaylistSchedules] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [mobileView, setMobileView] = useState('list');
  const [confirmCfg, setConfirmCfg] = useState(null);

  const isMobile = useIsMobile(1023);
  const setTopBarAction = useContext(LayoutTopBarActionContext);

  const revokeUploadPreviews = useCallback(() => {
    const urls = uploadPreviewUrlsRef.current;
    urls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
    urls.clear();
  }, []);

  const clearUploadFiles = useCallback(() => {
    revokeUploadPreviews();
    setUploadFiles([]);
  }, [revokeUploadPreviews]);

  useEffect(() => {
    // Cleanup in case user navigates away with previews allocated
    return () => {
      revokeUploadPreviews();
    };
  }, [revokeUploadPreviews]);

  useEffect(() => {
    fetchPlaylists();
    fetchDeviceGroups();
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileView('list');
  }, [isMobile]);

  useEffect(() => {
    const set = setTopBarAction;
    if (typeof set !== 'function') return;
    if (!isMobile || mobileView !== 'list') {
      set(null);
      return;
    }
    set(
      <button
        type="button"
        className="mobile-top-bar-add-btn playlists-top-add"
        onClick={() => setShowCreateModal(true)}
        aria-label="Create playlist"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    );
    return () => set(null);
  }, [isMobile, mobileView, setTopBarAction]);

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

  const selectPlaylist = async (playlistId) => {
    if (isMobile) setMobileView('detail');
    await fetchPlaylistDetails(playlistId);
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
      const createdResp = await playlistAPI.createPlaylist(
        newPlaylist.name,
        newPlaylist.description
      );
      const createdId = createdResp?.playlist?.id;
      setNewPlaylist({ name: '', description: '' });
      setShowCreateModal(false);
      setUploadFiles([]);
      await fetchPlaylists();

      // Auto-select the newly created playlist and open upload modal
      if (createdId) {
        await fetchPlaylistDetails(createdId);
        setShowUploadModal(true);
        if (isMobile) setMobileView('detail');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create playlist');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlaylist = (id) => {
    const target = playlists.find((p) => p.id === id);
    if (String(target?.status || '').toLowerCase() === 'active') {
      setError('Cannot delete an active playlist. Deactivate it first.');
      return;
    }
    setConfirmCfg({
      title: 'Delete playlist',
      message: 'Are you sure you want to delete this playlist?',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          setLoading(true);
          await playlistAPI.deletePlaylist(id);
          if (selectedPlaylist?.id === id) {
            setSelectedPlaylist(null);
            setMobileView('list');
          }
          fetchPlaylists();
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to delete playlist');
        } finally {
          setLoading(false);
          setConfirmCfg(null);
        }
      },
    });
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
      setUploadProgress(0);
      setError('');
      const files = uploadFiles.map((entry) => entry.file);
      const durations = uploadFiles.map((entry) =>
        entry.file.type.startsWith('image/') ? entry.duration : null
      );
      await playlistAPI.uploadFiles(selectedPlaylist.id, files, durations, {
        onProgress: (percent) => {
          setUploadProgress((prev) => (percent > prev ? percent : prev));
        },
      });
      clearUploadFiles();
      setShowUploadModal(false);
      fetchPlaylistDetails(selectedPlaylist.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload files');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelected = (filesList) => {
    if (!filesList || !filesList.length) return;
    setError('');

    const remaining = MAX_UPLOAD_FILES - uploadFiles.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_UPLOAD_FILES} files allowed per upload.`);
      return;
    }

    const incoming = Array.from(filesList);
    const filesToAdd = incoming.slice(0, remaining);
    if (incoming.length > remaining) {
      setError(`Only ${remaining} more file${remaining === 1 ? '' : 's'} can be added (max ${MAX_UPLOAD_FILES}).`);
    }

    const newEntries = filesToAdd.map((file) => ({
      file,
      // Default duration: 10s for images, null for videos
      duration: file.type.startsWith('image/') ? 10 : null,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));

    newEntries.forEach((e) => {
      if (e.previewUrl) uploadPreviewUrlsRef.current.add(e.previewUrl);
    });
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

  const handleDeleteItem = (itemId) => {
    setConfirmCfg({
      title: 'Remove item',
      message: 'Remove this item from the playlist?',
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        try {
          setLoading(true);
          await playlistAPI.deleteItem(itemId);
          fetchPlaylistDetails(selectedPlaylist.id);
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to delete item');
        } finally {
          setLoading(false);
          setConfirmCfg(null);
        }
      },
    });
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
      } else if (form.mode === 'forever') {
        await playlistAPI.schedulePlaylist(
          selectedPlaylist.id,
          form.start_time || null,
          null,
          parseInt(form.device_group_id)
        );
      } else {
        if (!form.start_time) {
          setError('Start time is required');
          return;
        }
        if (!form.end_time) {
          setError('End time is required');
          return;
        }
        await playlistAPI.schedulePlaylist(
          selectedPlaylist.id,
          form.start_time,
          form.end_time,
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

  const handleDeleteSchedule = useCallback(
    (scheduleId) => {
      setConfirmCfg({
        title: 'Delete schedule',
        message: 'Delete this schedule?',
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: async () => {
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
            setConfirmCfg(null);
          }
        },
      });
    },
    [selectedPlaylist?.id]
  );

  const handleClearOneTimeSchedule = useCallback((playlistId) => {
    setConfirmCfg({
      title: 'Clear schedule',
      message: 'Clear the one-time schedule for this playlist?',
      confirmLabel: 'Clear',
      danger: true,
      onConfirm: async () => {
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
          setConfirmCfg(null);
        }
      },
    });
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

  const listHiddenClass =
    isMobile && mobileView === 'detail' ? ' is-hidden-mobile' : '';
  const detailHiddenClass =
    isMobile && mobileView === 'list' ? ' is-hidden-mobile' : '';

  return (
    <div className="playlists-page">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>Playlists</h1>
            <p>Manage your digital signage playlists</p>
          </div>
          <button 
            className="create-btn create-btn-desktop-only"
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
        <div className={`playlists-list${listHiddenClass}`}>
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
                (() => {
                  const isActive = String(playlist.status || '').trim().toLowerCase() === 'active';
                  return (
                <div
                  key={playlist.id}
                  className={`playlist-card ${selectedPlaylist?.id === playlist.id ? 'active' : ''}`}
                  onClick={() => selectPlaylist(playlist.id)}
                >
                  <div className="playlist-card-header">
                    <h3>{playlist.name}</h3>
                    <button
                      className="delete-btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isActive) {
                          setError('Cannot delete an active playlist. Deactivate it first.');
                          return;
                        }
                        handleDeletePlaylist(playlist.id);
                      }}
                      disabled={isActive}
                      title={isActive ? 'Deactivate this playlist to delete it' : 'Delete playlist'}
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
                  );
                })()
              ))}
            </div>
          )}
        </div>

        <div className={`playlist-detail${detailHiddenClass}`}>
          {selectedPlaylist ? (
            <>
              {isMobile && mobileView === 'detail' && (
                <div className="playlists-mobile-back-bar">
                  <button
                    type="button"
                    className="playlists-mobile-back"
                    onClick={() => setMobileView('list')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span>Playlists</span>
                  </button>
                </div>
              )}
              <div className="playlist-detail-body">
              <div className="detail-header">
                <div>
                  <h2>{selectedPlaylist.name}</h2>
                  <p>{selectedPlaylist.description || 'No description'}</p>
                  <div className="playlist-status-badge">
                    <span className={`status-indicator ${statusClass(selectedPlaylist.status)}`}>
                      {statusClass(selectedPlaylist.status)}
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
                    {(() => {
                      const isEmpty = !selectedPlaylist?.items || selectedPlaylist.items.length === 0;
                      return (
                        <>
                    <button
                      className={`control-btn ${selectedPlaylist.status === 'active' ? 'active' : ''}`}
                      onClick={() => setShowActivateModal(true)}
                      disabled={selectedPlaylist.status === 'active' || isEmpty}
                      title={isEmpty ? 'Add at least one item to activate' : undefined}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      {selectedPlaylist.status === 'active' ? 'Active' : 'Set Active'}
                    </button>
                    <button
                      className="control-btn schedule-btn"
                      onClick={() => setShowScheduleModal(true)}
                      disabled={isEmpty}
                      title={isEmpty ? 'Add at least one item to schedule' : undefined}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      Schedule
                    </button>
                        </>
                      );
                    })()}
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
                    type="button"
                    className="upload-btn upload-btn-desktop-only"
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
              </div>
              <div className="playlist-detail-upload-bar">
                <button
                  type="button"
                  className="upload-btn upload-btn-mobile-only"
                  onClick={() => setShowUploadModal(true)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Upload File
                </button>
              </div>
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
      <Sheet
        open={Boolean(showUploadModal && selectedPlaylist)}
        title="Upload File to Playlist"
        onClose={() => {
          clearUploadFiles();
          setShowUploadModal(false);
        }}
        maxWidth="560px"
        footer={
          <div className="modal-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="cancel-btn"
              onClick={clearUploadFiles}
              disabled={uploading || uploadFiles.length === 0}
            >
              Clear Files
            </button>
            <button
              type="button"
              className="cancel-btn"
              onClick={() => {
                clearUploadFiles();
                setShowUploadModal(false);
              }}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="upload-files-form"
              className="submit-btn"
              disabled={uploading || uploadFiles.length === 0}
            >
              {uploading ? `Uploading ${Math.max(0, Math.min(100, uploadProgress || 0))}%` : 'Upload Files'}
            </button>
          </div>
        }
      >
        {selectedPlaylist ? (
          <form id="upload-files-form" onSubmit={handleUploadFile}>
            {uploading && (
              <div className="playlist-upload-progress playlist-upload-progress--top" aria-live="polite">
                <div className="playlist-upload-progress__row">
                  <span className="playlist-upload-progress__spinner" aria-hidden="true" />
                  <span className="playlist-upload-progress__label">
                    Uploading {Math.max(0, Math.min(100, uploadProgress || 0))}%
                  </span>
                </div>
                <div
                  className="playlist-upload-progress__bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.max(0, Math.min(100, uploadProgress || 0))}
                >
                  <div
                    className="playlist-upload-progress__barFill"
                    style={{ width: `${Math.max(0, Math.min(100, uploadProgress || 0))}%` }}
                  />
                </div>
              </div>
            )}
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
                    ? `${uploadFiles.length}/${MAX_UPLOAD_FILES} selected`
                    : `Choose files or drag and drop (max ${MAX_UPLOAD_FILES})`}
                </label>
              </div>
              <small>Maximum {MAX_UPLOAD_FILES} files per upload.</small>

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
                            {entry.previewUrl && (
                              <img
                                className="upload-image-thumb"
                                src={entry.previewUrl}
                                alt={entry.file.name}
                              />
                            )}
                            Duration (s):{' '}
                            <input
                              type="number"
                              min="1"
                              value={entry.duration ?? 10}
                              onChange={(e) => {
                                const value = parseInt(e.target.value, 10);
                                setUploadFiles((prev) =>
                                  prev.map((item, i) =>
                                    i === index
                                      ? {
                                          ...item,
                                          duration: Number.isNaN(value) || value < 1 ? 1 : value,
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
          </form>
        ) : null}
      </Sheet>

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

      <ConfirmSheet
        open={Boolean(confirmCfg)}
        title={confirmCfg?.title || 'Confirm'}
        message={confirmCfg?.message || ''}
        confirmLabel={confirmCfg?.confirmLabel || 'OK'}
        danger={confirmCfg?.danger}
        onClose={() => setConfirmCfg(null)}
        onConfirm={confirmCfg?.onConfirm || (async () => {})}
      />
    </div>
  );
}

export default Playlists;
