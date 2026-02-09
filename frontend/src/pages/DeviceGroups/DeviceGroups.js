import './DeviceGroups.css';
import { useState, useEffect } from 'react';
import { deviceGroupAPI, deviceAPI } from '../../services/api';

function DeviceGroups() {
  const [groups, setGroups] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editGroupName, setEditGroupName] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGroups();
    fetchDevices();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await deviceGroupAPI.getGroups();
      setGroups(response.groups || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await deviceAPI.getDevices();
      setDevices(response.devices || []);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    }
  };

  const fetchGroupDetails = async (groupId) => {
    try {
      const response = await deviceGroupAPI.getGroup(groupId);
      setSelectedGroup(response.group);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch group details');
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setError('Group name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await deviceGroupAPI.createGroup(newGroupName.trim());
      setNewGroupName('');
      setShowCreateModal(false);
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!editGroupName.trim()) {
      setError('Group name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await deviceGroupAPI.updateGroup(selectedGroup.id, editGroupName.trim());
      await deviceGroupAPI.updateGroupDevices(selectedGroup.id, selectedDeviceIds);
      setShowEditModal(false);
      fetchGroups();
      if (selectedGroup) {
        await fetchGroupDetails(selectedGroup.id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm('Are you sure you want to delete this group? Devices in this group will be moved to "All devices".')) {
      return;
    }

    try {
      setLoading(true);
      await deviceGroupAPI.deleteGroup(id);
      if (selectedGroup?.id === id) {
        setSelectedGroup(null);
      }
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete group');
    } finally {
      setLoading(false);
    }
  };

  const selectGroup = async (group) => {
    setSelectedGroup(group);
    await fetchGroupDetails(group.id);
  };

  const openEditModal = () => {
    if (!selectedGroup) return;
    setEditGroupName(selectedGroup.name);
    // Get device IDs that are currently in this group
    const currentDeviceIds = (selectedGroup.devices || []).map(d => d.id);
    setSelectedDeviceIds(currentDeviceIds);
    setShowEditModal(true);
  };

  const toggleDeviceSelection = (deviceId) => {
    setSelectedDeviceIds(prev => 
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const isGlobalGroup = (group) => {
    return group.user_id === null;
  };

  return (
    <div className="device-groups-page">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>Device Groups</h1>
            <p>Organize your devices into groups</p>
          </div>
          <button 
            className="create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Group
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="device-groups-container">
        <div className="device-groups-list">
          <h2>Your Groups</h2>
          {loading && !selectedGroup ? (
            <div className="loading">Loading groups...</div>
          ) : groups.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <p>No groups yet. Add your first group to get started!</p>
            </div>
          ) : (
            <div className="group-cards">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={`group-card ${selectedGroup?.id === group.id ? 'active' : ''}`}
                  onClick={() => selectGroup(group)}
                >
                  <div className="group-card-header">
                    <div className="group-icon-wrapper">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                    </div>
                    {!isGlobalGroup(group) && (
                      <button
                        className="delete-btn-small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    )}
                  </div>
                  <h3>{group.name}</h3>
                  <div className="group-meta">
                    <span className="device-count-badge">
                      {group.device_count || 0} {group.device_count === 1 ? 'device' : 'devices'}
                    </span>
                    {isGlobalGroup(group) && (
                      <>
                        <span className="meta-separator">•</span>
                        <span className="global-badge">Global</span>
                      </>
                    )}
                  </div>
                  {group.active_playlist_name ? (
                    <div className="active-playlist-badge">
                      Active: {group.active_playlist_name}
                    </div>
                  ) : (
                    <div className="no-playlist-badge">
                      No active playlist
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="group-detail">
          {selectedGroup ? (
            <>
              <div className="detail-header">
                <div className="detail-title-row">
                  <div className="detail-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </div>
                  <div>
                    <h2>{selectedGroup.name}</h2>
                    {isGlobalGroup(selectedGroup) && (
                      <span className="global-indicator">Global Group</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="detail-content">
                <div className="detail-section">
                  <h3>Group Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Group ID</span>
                      <span className="info-value">{selectedGroup.id}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Devices</span>
                      <span className="info-value">{selectedGroup.device_count || 0}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Created</span>
                      <span className="info-value">{new Date(selectedGroup.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Active Playlist</span>
                      <span className="info-value">
                        {selectedGroup.active_playlist_name ? (
                          <span className="active-playlist-name">{selectedGroup.active_playlist_name}</span>
                        ) : (
                          <span className="no-playlist-text">No active playlist</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Devices in Group</h3>
                  <p className="section-description">Manage which devices belong to this group</p>
                  {selectedGroup.devices && selectedGroup.devices.length > 0 ? (
                    <div className="devices-in-group">
                      {selectedGroup.devices.map((device) => (
                        <div key={device.id} className="device-item">
                          <div className="device-item-info">
                            <span className="device-item-name">{device.name}</span>
                            <span className={`device-item-status ${device.is_online ? 'online' : 'offline'}`}>
                              {device.is_online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-devices">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>No devices in this group</span>
                    </div>
                  )}
                  {!isGlobalGroup(selectedGroup) && (
                    <button 
                      className="edit-group-btn"
                      onClick={openEditModal}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Edit Group
                    </button>
                  )}
                </div>

                {!isGlobalGroup(selectedGroup) && (
                  <div className="danger-zone">
                    <h3>Danger Zone</h3>
                    <p>Permanently delete this group. Devices will be moved to "All devices".</p>
                    <button 
                      className="delete-group-btn"
                      onClick={() => handleDeleteGroup(selectedGroup.id)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                      Delete Group
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-detail">
              <div className="empty-detail-content">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <p>Select a group to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Group</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="form-group">
                <label>Group Name *</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Store Locations"
                  required
                  autoFocus
                />
                <small>Give your group a descriptive name</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditModal && selectedGroup && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Group</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleUpdateGroup}>
              <div className="form-group">
                <label>Group Name *</label>
                <input
                  type="text"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  placeholder="e.g., Store Locations"
                  required
                  autoFocus
                />
                <small>Update the group name</small>
              </div>
              <div className="form-group">
                <label>Select Devices</label>
                <div className="device-checkbox-list">
                  {devices.length === 0 ? (
                    <p className="no-devices-text">No devices available</p>
                  ) : (
                    devices.map((device) => (
                      <label key={device.id} className="device-checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedDeviceIds.includes(device.id)}
                          onChange={() => toggleDeviceSelection(device.id)}
                        />
                        <span className="device-checkbox-label">
                          {device.name}
                          <span className={`device-checkbox-status ${device.is_online ? 'online' : 'offline'}`}>
                            {device.is_online ? 'Online' : 'Offline'}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <small>Select which devices should be in this group</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowEditModal(false)}>
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

export default DeviceGroups;

