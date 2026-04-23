// services/VideoCallService.js
import { API_BASE_URL } from "../../../../../../axiosConfig";

/**
 * Helper to build the Authorization header from localStorage.
 */
const getAuthHeaders = () => {
  const token =
    localStorage.getItem("token") || localStorage.getItem("accessToken");
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

class VideoCallService {
  constructor() {
    this.baseURL = `${API_BASE_URL}/api/video`;
    this.currentCallId = null;
    this.currentRoomId = null;
    this.pollingInterval = null;
  }

  // POST: Initiate video call
  async initiateCall(userId, userName, counsellorId, counsellorName) {
    try {
      const response = await fetch(`${this.baseURL}/initiate`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId,
          userName,
          counsellorId,
          counsellorName,
          callType: "video",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        this.currentCallId = data.callId;
        this.currentRoomId = data.roomId;
        return data;
      } else {
        throw new Error("Failed to initiate call");
      }
    } catch (error) {
      console.error("Error initiating call:", error);
      throw error;
    }
  }

  // GET: Get waiting calls for counsellor
  async getWaitingCalls(counsellorId) {
    try {
      const response = await fetch(
        `${this.baseURL}/waiting/${counsellorId}`,
        { headers: getAuthHeaders() },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching waiting calls:", error);
      throw error;
    }
  }

  // POST: Accept call
  async acceptCall(callId) {
    try {
      const response = await fetch(`${this.baseURL}/accept/${callId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error accepting call:", error);
      throw error;
    }
  }

  // POST: Reject call
  async rejectCall(callId) {
    try {
      const response = await fetch(`${this.baseURL}/reject/${callId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error rejecting call:", error);
      throw error;
    }
  }

  // POST: End call
  async endCall(callId) {
    try {
      const response = await fetch(`${this.baseURL}/end/${callId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (this.currentCallId === callId) {
        this.currentCallId = null;
        this.currentRoomId = null;
      }

      return data;
    } catch (error) {
      console.error("Error ending call:", error);
      throw error;
    }
  }

  // Start polling for waiting calls
  startPolling(counsellorId, onNewCall, interval = 3000) {
    this.stopPolling();

    this.pollingInterval = setInterval(async () => {
      try {
        const data = await this.getWaitingCalls(counsellorId);
        if (data.success && data.waitingCalls && data.waitingCalls.length > 0) {
          onNewCall(data.waitingCalls);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, interval);
  }

  // Stop polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

export default new VideoCallService();
