// API Service Layer for SolSight App
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'
  : 'https://api.solsight.app/api';

// Storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_DATA_KEY = 'user_data';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Get auth headers
  async getAuthHeaders() {
    const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    const headers = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    return headers;
  }

  // Generic request method with error handling
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = await this.getAuthHeaders();

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle auth errors
        if (response.status === 401 && data.error?.code === 'TOKEN_EXPIRED') {
          await this.refreshToken();
          // Retry the original request
          return this.request(endpoint, options);
        }

        throw new Error(data.error?.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // Refresh access token
  async refreshToken() {
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Token refresh failed');
      }

      // Store new tokens
      await AsyncStorage.setItem(ACCESS_TOKEN_KEY, data.data.accessToken);
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, data.data.refreshToken);

      return data.data.accessToken;
    } catch (error) {
      // Clear tokens on refresh failure
      await this.clearAuthData();
      throw error;
    }
  }

  // Clear auth data
  async clearAuthData() {
    await AsyncStorage.multiRemove([
      ACCESS_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
      USER_DATA_KEY,
    ]);
  }

  // Store auth data
  async storeAuthData(accessToken, refreshToken, user) {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
  }

  // Authentication endpoints
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    await this.storeAuthData(
      data.data.accessToken,
      data.data.refreshToken,
      data.data.user
    );

    return data.data.user;
  }

  async register(userData) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    await this.storeAuthData(
      data.data.accessToken,
      data.data.refreshToken,
      data.data.user
    );

    return data.data.user;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      // Continue with logout even if request fails
    }
    await this.clearAuthData();
  }

  async getCurrentUser() {
    const userData = await AsyncStorage.getItem(USER_DATA_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async resetPassword(email) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // User endpoints
  async updateProfile(profileData) {
    const data = await this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });

    // Update stored user data
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(data.data));
    return data.data;
  }

  async setWalletAddress(walletAddress) {
    return this.request('/users/wallet', {
      method: 'POST',
      body: JSON.stringify({ walletAddress }),
    });
  }

  async updateAvailability(isAvailable) {
    return this.request('/users/availability', {
      method: 'PUT',
      body: JSON.stringify({ isAvailable }),
    });
  }

  async getUserStats() {
    return this.request('/users/stats');
  }

  async getUserTransactions(limit = 20) {
    return this.request(`/users/transactions?limit=${limit}`);
  }

  async getUserRewards(limit = 20, type = null) {
    const query = type ? `/users/rewards?limit=${limit}&type=${type}` : `/users/rewards?limit=${limit}`;
    return this.request(query);
  }

  // Matching endpoints
  async startMatching(options = {}) {
    return this.request('/matching/start', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async cancelMatching() {
    return this.request('/matching/cancel', { method: 'POST' });
  }

  async acceptMatch(roomId) {
    return this.request(`/matching/accept/${roomId}`, { method: 'POST' });
  }

  async declineMatch(roomId, reason) {
    return this.request(`/matching/decline/${roomId}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async endCall(roomId, endReason) {
    return this.request(`/matching/end/${roomId}`, {
      method: 'POST',
      body: JSON.stringify({ endReason }),
    });
  }

  async getQueueStatus() {
    return this.request('/matching/queue-status');
  }

  async getMatchingStats() {
    return this.request('/matching/stats');
  }

  // Call endpoints
  async createCall(callData) {
    return this.request('/calls/', {
      method: 'POST',
      body: JSON.stringify(callData),
    });
  }

  async getCall(callId) {
    return this.request(`/calls/${callId}`);
  }

  async updateCall(callId, updateData) {
    return this.request(`/calls/${callId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  async endCall(callId, rating, feedbackText, endReason) {
    return this.request(`/calls/${callId}/end`, {
      method: 'POST',
      body: JSON.stringify({ rating, feedbackText, endReason }),
    });
  }

  async getCallHistory(limit = 20, offset = 0, status = null, userType = null) {
    const query = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (status) query.append('status', status);
    if (userType) query.append('userType', userType);

    return this.request(`/calls/history?${query}`);
  }

  async getActiveCalls(limit = 10) {
    return this.request(`/calls/active?limit=${limit}`);
  }

  async getCallStats(period = '30d') {
    return this.request(`/calls/stats?period=${period}`);
  }

  // Rewards endpoints
  async getUserRewardHistory(limit = 20, type = null) {
    const query = type ? `/rewards/user?limit=${limit}&type=${type}` : `/rewards/user?limit=${limit}`;
    return this.request(query);
  }

  async getTransactionStatus(transactionId) {
    return this.request(`/rewards/transaction/${transactionId}`);
  }

  async getRewardStats(period = '30d') {
    return this.request(`/rewards/stats?period=${period}`);
  }

  async getBlockchainInfo() {
    return this.request('/rewards/blockchain-info');
  }

  // WebRTC endpoints
  async getICEServers() {
    return this.request('/webrtc/ice-servers');
  }

  async getRoomInfo(roomId) {
    return this.request(`/webrtc/room/${roomId}`);
  }

  async getWebRTCStats() {
    return this.request('/webrtc/stats');
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // WebSocket URL
  getWebSocketURL() {
    const wsProtocol = __DEV__ ? 'ws' : 'wss';
    const wsHost = __DEV__ ? 'localhost:3000' : 'api.solsight.app';
    return `${wsProtocol}://${wsHost}/api/webrtc/ws`;
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export convenience methods
export const {
  login,
  register,
  logout,
  getCurrentUser,
  changePassword,
  resetPassword,
  updateProfile,
  setWalletAddress,
  updateAvailability,
  getUserStats,
  getUserTransactions,
  getUserRewards,
  startMatching,
  cancelMatching,
  acceptMatch,
  declineMatch,
  endCall: endMatchingCall,
  createCall,
  getCall,
  updateCall,
  endCall: endApiCall,
  getCallHistory,
  getActiveCalls,
  getCallStats,
  getUserRewardHistory,
  getTransactionStatus,
  getRewardStats,
  getBlockchainInfo,
  getICEServers,
  getRoomInfo,
  getWebRTCStats,
  healthCheck,
  getWebSocketURL,
} = apiService;