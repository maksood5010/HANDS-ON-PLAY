import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5041/api";
const UPLOAD_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5041";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Get user ID from localStorage
const getUserId = () => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user).id : null;
};

// Add user_id to requests
api.interceptors.request.use((config) => {
  const userId = getUserId();
  if (userId) {
    // Add user_id to headers for all requests
    config.headers["x-user-id"] = userId;
    // Also add to params for GET requests and data for POST/PUT/DELETE
    if (config.method === "get" || config.method === "delete") {
      config.params = { ...config.params, user_id: userId };
    } else if (config.data instanceof FormData) {
      // For FormData, append user_id
      config.data.append("user_id", userId);
    } else {
      config.data = { ...config.data, user_id: userId };
    }
  }
  return config;
});

export const authAPI = {
  login: async (username, password) => {
    const response = await api.post("/login", { username, password });
    return response.data;
  },
};

export const userAPI = {
  listUsers: async () => {
    const response = await api.get("/users");
    return response.data;
  },
  createUser: async (username, password, role) => {
    const response = await api.post("/users", { username, password, role });
    return response.data;
  },
  updateUser: async (id, fields) => {
    const response = await api.put(`/users/${id}`, fields);
    return response.data;
  },
  deleteUser: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};

export const messageAPI = {
  getMessage: async () => {
    const response = await api.get("/message");
    return response.data;
  },
};

export const playlistAPI = {
  createPlaylist: async (name, description) => {
    const response = await api.post("/playlists", { name, description });
    return response.data;
  },

  getPlaylists: async () => {
    const response = await api.get("/playlists");
    return response.data;
  },

  getPlaylist: async (id) => {
    const response = await api.get(`/playlists/${id}`);
    return response.data;
  },

  updatePlaylist: async (id, name, description) => {
    const response = await api.put(`/playlists/${id}`, { name, description });
    return response.data;
  },

  deletePlaylist: async (id) => {
    const response = await api.delete(`/playlists/${id}`);
    return response.data;
  },

  uploadFile: async (playlistId, file, duration) => {
    const formData = new FormData();
    formData.append("file", file);
    if (duration) {
      formData.append("duration", duration);
    }
    const userId = getUserId();
    if (userId) {
      formData.append("user_id", userId);
    }

    const response = await axios.post(
      `${API_BASE_URL}/playlists/${playlistId}/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          "x-user-id": userId || "",
        },
      }
    );
    return response.data;
  },

  getPlaylistItems: async (playlistId) => {
    const response = await api.get(`/playlists/${playlistId}/items`);
    return response.data;
  },

  updateItemDuration: async (itemId, duration) => {
    const response = await api.put(`/playlist-items/${itemId}/duration`, { duration });
    return response.data;
  },

  updateItemOrder: async (itemId, direction) => {
    const response = await api.put(`/playlist-items/${itemId}/order`, { direction });
    return response.data;
  },

  deleteItem: async (itemId) => {
    const response = await api.delete(`/playlist-items/${itemId}`);
    return response.data;
  },

  setPlaylistActive: async (playlistId, deviceGroupId) => {
    const response = await api.post(`/playlists/${playlistId}/activate`, {
      device_group_id: deviceGroupId
    });
    return response.data;
  },

  setPlaylistInactive: async (playlistId) => {
    const response = await api.post(`/playlists/${playlistId}/deactivate`);
    return response.data;
  },

  schedulePlaylist: async (playlistId, startTime, endTime, deviceGroupId) => {
    const response = await api.post(`/playlists/${playlistId}/schedule`, {
      start_time: startTime,
      end_time: endTime,
      device_group_id: deviceGroupId
    });
    return response.data;
  },
};

export const deviceAPI = {
  getDevices: async () => {
    const response = await api.get("/devices");
    return response.data;
  },

  getDevice: async (id) => {
    const response = await api.get(`/devices/${id}`);
    return response.data;
  },

  createDevice: async (name, groupId) => {
    const response = await api.post("/devices", { name, groupId });
    return response.data;
  },

  deleteDevice: async (id) => {
    const response = await api.delete(`/devices/${id}`);
    return response.data;
  },

  assignPlaylist: async (deviceId, playlistId) => {
    const response = await api.put(`/devices/${deviceId}/playlist`, { playlistId });
    return response.data;
  },
};

export const deviceGroupAPI = {
  getGroups: async () => {
    const response = await api.get("/device-groups");
    return response.data;
  },

  getGroup: async (id) => {
    const response = await api.get(`/device-groups/${id}`);
    return response.data;
  },

  createGroup: async (name) => {
    const response = await api.post("/device-groups", { name });
    return response.data;
  },

  updateGroup: async (id, name) => {
    const response = await api.put(`/device-groups/${id}`, { name });
    return response.data;
  },

  deleteGroup: async (id) => {
    const response = await api.delete(`/device-groups/${id}`);
    return response.data;
  },

  updateGroupDevices: async (id, deviceIds) => {
    const response = await api.put(`/device-groups/${id}/devices`, { deviceIds });
    return response.data;
  },
};

export const dashboardAPI = {
  getSummary: async () => {
    const response = await api.get("/dashboard-summary");
    return response.data;
  },
};

export const getFileUrl = (filePath) => {
  return `${UPLOAD_BASE_URL}/uploads/${filePath}`;
};

export default api;

