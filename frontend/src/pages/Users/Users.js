import "./Users.css";
import { useEffect, useMemo, useState } from "react";
import { userAPI } from "../../services/api";

const roles = ["company_admin", "company_user"];

const roleLabel = (role) => {
  if (role === "company_user") return "User";
  if (role === "company_admin") return "Admin";
  if (role === "platform_super_admin") return "Platform Super Admin";
  return role || "User";
};

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("Customer");

  const [editId, setEditId] = useState(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("Customer");

  const me = useMemo(() => {
    const raw = localStorage.getItem("user");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const loadUsers = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await userAPI.listUsers();
      const list = res.users || [];
      setUsers(list);
      if (!selectedUser && list.length > 0) {
        setSelectedUser(list[0]);
      } else if (selectedUser) {
        const updated = list.find((u) => u.id === selectedUser.id);
        setSelectedUser(updated || list[0] || null);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (u) => {
    setEditId(u.id);
    setEditUsername(u.username);
    setEditPassword("");
    setEditRole(u.role);
    setShowEditModal(true);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditUsername("");
    setEditPassword("");
    setEditRole("Customer");
    setShowEditModal(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await userAPI.createUser(newUsername, newPassword, newRole);
      setNewUsername("");
      setNewPassword("");
      setNewRole("Customer");
      setShowCreateModal(false);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create user");
    }
  };

  const handleSave = async () => {
    setError("");
    try {
      const fields = {
        username: editUsername,
        role: editRole,
      };
      if (editPassword) fields.password = editPassword;

      await userAPI.updateUser(editId, fields);
      cancelEdit();
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update user");
    }
  };

  const handleDelete = async (u) => {
    setError("");
    const ok = window.confirm(`Delete user "${u.username}"?`);
    if (!ok) return;

    try {
      await userAPI.deleteUser(u.id);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete user");
    }
  };

  return (
    <div className="device-groups-page users-page">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>Users</h1>
            <p>Company user management</p>
          </div>
          <button
            className="create-btn"
            type="button"
            onClick={() => setShowCreateModal(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add User
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      <div className="device-groups-container users-layout">
        <div className="device-groups-list">
          <h2>Your Users</h2>
          {loading ? (
            <div className="loading">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <p>No users yet. Add your first user to get started!</p>
            </div>
          ) : (
            <div className="group-cards">
              {users.map((u) => {
                const isMe = me?.id === u.id;
                return (
                  <div
                    key={u.id}
                    className={`group-card ${selectedUser?.id === u.id ? "active" : ""}`}
                    onClick={() => setSelectedUser(u)}
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
                      <button
                        className="delete-btn-small"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isMe) {
                            handleDelete(u);
                          }
                        }}
                        disabled={isMe}
                        title={isMe ? "You cannot delete your own account" : "Delete user"}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                    <h3>{u.username}</h3>
                    <div className="group-meta">
                      <span className="device-count-badge">{roleLabel(u.role)}</span>
                      {u.company_name && (
                        <>
                          <span className="meta-separator">•</span>
                          <span className="global-badge">{u.company_name}</span>
                        </>
                      )}
                      {isMe && (
                        <>
                          <span className="meta-separator">•</span>
                          <span className="global-badge">You</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="group-detail">
          {selectedUser ? (
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
                    <h2>{selectedUser.username}</h2>
                    <span className="global-indicator">
                      Role: {roleLabel(selectedUser.role)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-content">
                <div className="detail-section">
                  <h3>User Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">User ID</span>
                      <span className="info-value">{selectedUser.id}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Username</span>
                      <span className="info-value">{selectedUser.username}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Role</span>
                      <span className="info-value">{roleLabel(selectedUser.role)}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Company</span>
                      <span className="info-value">
                        {selectedUser.company_name || selectedUser.company_id || "—"}
                      </span>
                    </div>
                    {selectedUser.created_at && (
                      <div className="info-item">
                        <span className="info-label">Created</span>
                        <span className="info-value">
                          {new Date(selectedUser.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Actions</h3>
                  <p className="section-description">Edit this user or change their password.</p>
                  <button
                    className="edit-group-btn"
                    type="button"
                    onClick={() => startEdit(selectedUser)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit User
                  </button>
                </div>

                <div className="danger-zone">
                  <h3>Danger Zone</h3>
                  <p>Permanently delete this user. This action cannot be undone.</p>
                  <button
                    className="delete-group-btn"
                    type="button"
                    onClick={() => handleDelete(selectedUser)}
                    disabled={me?.id === selectedUser.id}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    Delete User
                  </button>
                </div>
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
                <p>Select a user to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New User</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g., johndoe"
                  required
                  autoFocus
                />
                <small>Enter a unique username for this user</small>
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                />
                <small>This password will be hashed and stored securely</small>
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={cancelEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit User</h2>
              <button className="close-btn" onClick={cancelEdit}>×</button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                />
                <small>Update the username</small>
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>New Password (optional)</label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;

