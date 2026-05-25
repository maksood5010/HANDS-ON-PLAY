import './Devices.css';
import { useState, useEffect, useContext, useRef } from 'react';
import { deviceAPI, deviceGroupAPI } from '../../services/api';
import { useIsMobile } from '../../hooks/useIsMobile';
import { LayoutTopBarActionContext } from '../../components/Layout/LayoutTopBarActionContext';
import ConfirmSheet from '../../components/common/ConfirmSheet/ConfirmSheet';

/** Returns absolute http(s) URL or null if not previewable. */
function getValidPlaybackUrl(value) {
  if (!value || value === 'not_playing') return null;
  try {
    const url = new URL(String(value).trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Preview URL and/or display label for the Now playing row. */
function resolveNowPlayingDisplay(status) {
  if (!status) return { previewUrl: null, label: null };

  const raw = status.currently_playing;
  const previewUrl = getValidPlaybackUrl(raw);
  if (previewUrl) return { previewUrl, label: null };

  const playbackState = String(status.playback_state || '').toLowerCase();
  const isActive =
    playbackState === 'playing' ||
    playbackState === 'idle' ||
    playbackState === 'setup';

  if (isActive && raw && raw !== 'not_playing') {
    const name = String(raw).trim();
    return { previewUrl: null, label: name };
  }

  return { previewUrl: null, label: null };
}

function mediaKindFromUrl(url) {
  const path = url.split('?')[0].toLowerCase();
  if (/\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(path)) return 'image';
  if (/\.(mp4|webm|ogg|mov|m4v|mkv)$/i.test(path)) return 'video';
  return 'unknown';
}

function DeviceMediaPreviewModal({ url, title, onClose }) {
  const videoRef = useRef(null);
  const kind = mediaKindFromUrl(url);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(
    () => () => {
      if (videoRef.current) videoRef.current.pause();
    },
    []
  );

  return (
    <div
      className="modal-overlay playlist-media-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-content modal-content--media-preview"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-media-preview-title"
      >
        <div className="modal-header">
          <h2 id="device-media-preview-title">{title}</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close preview">
            ×
          </button>
        </div>
        <div className="playlist-media-preview-body">
          {kind === 'image' ? (
            <img src={url} alt={title} className="playlist-media-preview__media" />
          ) : (
            <video
              ref={videoRef}
              src={url}
              className="playlist-media-preview__media"
              controls
              autoPlay
              playsInline
            >
              Your browser does not support video playback.
            </video>
          )}
        </div>
      </div>
    </div>
  );
}

/** User-facing message for live status API errors (no technical protocol names). */
function formatLiveStatusError(err) {
  const reason = err.response?.data?.reason;
  const apiError = err.response?.data?.error;

  if (reason === 'offline') return 'Device is offline';
  if (reason === 'mqtt_unavailable') {
    return 'Unable to reach the device right now. Try again shortly.';
  }
  if (reason === 'timeout') {
    return 'The device did not respond in time. Try again.';
  }
  if (typeof apiError === 'string') {
    if (/mqtt/i.test(apiError)) {
      return 'Unable to reach the device right now. Try again shortly.';
    }
    if (/timed out/i.test(apiError)) {
      return 'The device did not respond in time. Try again.';
    }
    return apiError;
  }
  return 'Could not load playback and health details';
}

function heartbeatBadgeClass(kind, value) {
  if (!value) return 'heartbeat-badge neutral';
  const v = String(value).toLowerCase();
  if (kind === 'health') {
    if (v === 'ok') return 'heartbeat-badge ok';
    if (v === 'warning') return 'heartbeat-badge warning';
    if (v === 'error') return 'heartbeat-badge error';
  }
  if (kind === 'playback') {
    if (v === 'app_closed') return 'heartbeat-badge neutral';
    if (v === 'playing') return 'heartbeat-badge ok';
    if (v === 'idle' || v === 'setup') return 'heartbeat-badge warning';
    if (v === 'error') return 'heartbeat-badge error';
  }
  return 'heartbeat-badge neutral';
}

function Devices() {
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [showDeviceKey, setShowDeviceKey] = useState(false);
  const [mobileView, setMobileView] = useState('list');
  const [confirmCfg, setConfirmCfg] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [liveStatusLoading, setLiveStatusLoading] = useState(false);
  const [liveStatusError, setLiveStatusError] = useState('');

  const isMobile = useIsMobile(1023);
  const nowPlaying = resolveNowPlayingDisplay(liveStatus);
  const playbackPreviewUrl = nowPlaying.previewUrl;
  const nowPlayingLabel = nowPlaying.label;
  const setTopBarAction = useContext(LayoutTopBarActionContext);

  useEffect(() => {
    fetchDevices();
    fetchGroups();
  }, []);

  useEffect(() => {
    setMediaPreview(null);
  }, [selectedDevice?.id]);

  const fetchLiveStatus = async (deviceId, isOnline) => {
    if (!deviceId) {
      setLiveStatus(null);
      setLiveStatusError('');
      return;
    }
    if (!isOnline) {
      setLiveStatus(null);
      setLiveStatusError('Device is offline');
      setLiveStatusLoading(false);
      return;
    }
    try {
      setLiveStatusLoading(true);
      setLiveStatusError('');
      const response = await deviceAPI.getDeviceStatus(deviceId);
      setLiveStatus(response.status || null);
    } catch (err) {
      setLiveStatus(null);
      setLiveStatusError(formatLiveStatusError(err));
    } finally {
      setLiveStatusLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedDevice?.id) {
      setLiveStatus(null);
      setLiveStatusError('');
      setLiveStatusLoading(false);
      return;
    }
    fetchLiveStatus(selectedDevice.id, selectedDevice.is_online);
  }, [selectedDevice?.id, selectedDevice?.is_online]);

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
        className="mobile-top-bar-add-btn"
        onClick={() => setShowCreateModal(true)}
        aria-label="Add device"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    );
    return () => set(null);
  }, [isMobile, mobileView, setTopBarAction]);

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
      if (isMobile) setMobileView('detail');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create device');
    } finally {
      setLoading(false);
    }
  };

  const runDeleteDevice = async (id) => {
    try {
      setLoading(true);
      await deviceAPI.deleteDevice(id);
      if (selectedDevice?.id === id) {
        setSelectedDevice(null);
        setMobileView('list');
      }
      fetchDevices();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete device');
    } finally {
      setLoading(false);
    }
  };

  const requestDeleteDevice = (id) => {
    setConfirmCfg({
      title: 'Delete device',
      message: 'Are you sure you want to delete this device?',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        await runDeleteDevice(id);
        setConfirmCfg(null);
      },
    });
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
    if (isMobile) setMobileView('detail');
  };

  const listHiddenClass =
    isMobile && mobileView === 'detail' ? ' is-hidden-mobile' : '';
  const detailHiddenClass =
    isMobile && mobileView === 'list' ? ' is-hidden-mobile' : '';

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
            className="create-btn create-btn-desktop-only"
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
        <div className={`devices-list${listHiddenClass}`}>
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
                        requestDeleteDevice(device.id);
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

        <div className={`device-detail${detailHiddenClass}`}>
          {selectedDevice ? (
            <>
              {isMobile && mobileView === 'detail' && (
                <div className="devices-mobile-back-bar">
                  <button
                    type="button"
                    className="devices-mobile-back"
                    onClick={() => setMobileView('list')}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <span>Devices</span>
                  </button>
                </div>
              )}
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

                <div className="detail-section">
                  <h3>Playback &amp; health</h3>
                  <p className="section-description">
                    Current playback and health, requested from the device when you view this page
                  </p>
                  {liveStatusLoading ? (
                    <p className="heartbeat-muted">Loading playback and health…</p>
                  ) : liveStatusError ? (
                    <div className="live-status-error">
                      <p className="heartbeat-muted">{liveStatusError}</p>
                      {selectedDevice.is_online && (
                        <button
                          type="button"
                          className="copy-btn"
                          onClick={() =>
                            fetchLiveStatus(selectedDevice.id, selectedDevice.is_online)
                          }
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">App version</span>
                        <span className="info-value">
                          {liveStatus?.app_version || '—'}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Now playing</span>
                        <span className="info-value">
                          {playbackPreviewUrl ? (
                            <button
                              type="button"
                              className="copy-btn"
                              aria-label={`Preview media for ${selectedDevice.name}`}
                              onClick={() =>
                                setMediaPreview({
                                  url: playbackPreviewUrl,
                                  title: selectedDevice.name || 'Now playing',
                                })
                              }
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                              Preview
                            </button>
                          ) : nowPlayingLabel ? (
                            <span className="info-value">{nowPlayingLabel}</span>
                          ) : (
                            <span className="heartbeat-muted">Not playing</span>
                          )}
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Playback</span>
                        <span className="info-value">
                          <span
                            className={heartbeatBadgeClass(
                              'playback',
                              liveStatus?.playback_state
                            )}
                          >
                            {liveStatus?.playback_state === 'app_closed'
                              ? 'App closed'
                              : (liveStatus?.playback_state || '—')}
                          </span>
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Health</span>
                        <span className="info-value">
                          <span
                            className={heartbeatBadgeClass(
                              'health',
                              liveStatus?.health_status
                            )}
                          >
                            {liveStatus?.health_status || '—'}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="danger-zone">
                  <h3>Danger Zone</h3>
                  <p>Permanently delete this device and remove it from your account.</p>
                  <button 
                    className="delete-device-btn"
                    onClick={() => requestDeleteDevice(selectedDevice.id)}
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

      {mediaPreview && (
        <DeviceMediaPreviewModal
          url={mediaPreview.url}
          title={mediaPreview.title}
          onClose={() => setMediaPreview(null)}
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

export default Devices;
