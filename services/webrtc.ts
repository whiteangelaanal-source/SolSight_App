import { apiService } from './api';
import { io, Socket } from 'socket.io-client';

export interface WebRTCMessage {
  type: string;
  data: any;
  timestamp?: number;
}

export interface RoomInfo {
  id: string;
  status: string;
  participantCount: number;
  participants: Array<{
    userId: string;
    userType: string;
    joinedAt: number;
    isReady: boolean;
  }>;
}

export interface ICEServers {
  iceServers: Array<{
    urls: string;
    username?: string;
    credential?: string;
  }>;
  maxCallDuration?: number;
  connectionTimeout?: number;
}

class WebRTCService {
  private socket: Socket | null = null;
  private localPeerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private currentUserType: 'blind' | 'volunteer' | null = null;
  private iceCandidates: Array<RTCIceCandidate> = [];
  private isInitiator: boolean = false;
  private isConnected: boolean = false;

  // Event callbacks
  private onConnectedCallbacks: Array<() => void> = [];
  private onDisconnectedCallbacks: Array<() => void> = [];
  private onRemoteStreamCallbacks: Array<(stream: MediaStream) => void> = [];
  private onErrorCallbacks: Array<(error: Error) => void> = [];
  private onRoomStatusCallbacks: Array<(status: string) => void> = [];

  constructor() {
    this.setupEventHandlers();
  }

  // Initialize WebRTC connection
  async initialize(userId: string, userType: 'blind' | 'volunteer'): Promise<void> {
    try {
      this.currentUserId = userId;
      this.currentUserType = userType;

      // Get ICE servers
      const iceConfig = await apiService.getICEServers();

      // Create peer connection
      this.localPeerConnection = new RTCPeerConnection({
        iceServers: iceConfig.data.iceServers,
      });

      this.setupPeerConnectionHandlers();

      // Get local media stream
      await this.getLocalMediaStream();

      // Connect to WebSocket server
      await this.connectToSignalingServer();

      console.log('WebRTC initialized for user:', userId, userType);
    } catch (error) {
      console.error('WebRTC initialization failed:', error);
      throw error;
    }
  }

  // Get local media stream
  private async getLocalMediaStream(): Promise<void> {
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Add tracks to peer connection
      if (this.localPeerConnection && this.localStream) {
        this.localStream.getTracks().forEach(track => {
          this.localPeerConnection!.addTrack(track, this.localStream!);
        });
      }

      console.log('Local media stream obtained');
    } catch (error) {
      console.error('Failed to get local media stream:', error);
      throw error;
    }
  }

  // Connect to signaling server
  private async connectToSignalingServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsURL = apiService.getWebSocketURL();

      this.socket = io(wsURL, {
        transports: ['websocket'],
        upgrade: false,
      });

      this.socket.on('connect', () => {
        console.log('Connected to WebRTC signaling server');
        this.isConnected = true;
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });

      this.socket.on('message', (message: WebRTCMessage) => {
        this.handleSignalingMessage(message);
      });

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.onErrorCallbacks.forEach(callback => callback(error));
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from WebRTC signaling server');
        this.isConnected = false;
        this.onDisconnectedCallbacks.forEach(callback => callback());
      });
    });
  }

  // Setup peer connection event handlers
  private setupPeerConnectionHandlers(): void {
    if (!this.localPeerConnection) return;

    // Handle ICE candidates
    this.localPeerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage('ice_candidate', {
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    this.localPeerConnection.onconnectionstatechange = () => {
      const state = this.localPeerConnection!.connectionState;
      console.log('Connection state:', state);

      switch (state) {
        case 'connected':
          this.onConnectedCallbacks.forEach(callback => callback());
          break;
        case 'disconnected':
        case 'failed':
          this.onDisconnectedCallbacks.forEach(callback => callback());
          break;
      }
    };

    // Handle remote streams
    this.localPeerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.onRemoteStreamCallbacks.forEach(callback => callback(this.remoteStream!));
        console.log('Remote stream received');
      }
    };
  }

  // Join room
  async joinRoom(roomId: string): Promise<void> {
    if (!this.isConnected || !this.currentUserId || !this.currentUserType) {
      throw new Error('WebRTC not initialized');
    }

    try {
      // Get room info first
      const roomInfo = await apiService.getRoomInfo(roomId);
      if (!roomInfo.data) {
        throw new Error('Room not found');
      }

      this.currentRoomId = roomId;

      // Send join room message
      await this.sendSignalingMessage('join_room', {
        roomId,
        userId: this.currentUserId,
        userType: this.currentUserType,
      });

      console.log('Joined room:', roomId);
    } catch (error) {
      console.error('Failed to join room:', error);
      throw error;
    }
  }

  // Handle signaling messages
  private async handleSignalingMessage(message: WebRTCMessage): Promise<void> {
    const { type, data } = message;

    switch (type) {
      case 'user_joined':
        console.log('User joined room:', data);
        break;

      case 'user_left':
        console.log('User left room:', data);
        break;

      case 'offer':
        await this.handleOffer(data);
        break;

      case 'answer':
        await this.handleAnswer(data);
        break;

      case 'ice_candidate':
        await this.handleIceCandidate(data);
        break;

      case 'room_joined':
        console.log('Successfully joined room:', data);
        break;

      case 'call_status':
        this.onRoomStatusCallbacks.forEach(callback => callback(data.status));
        break;

      case 'error':
        console.error('Signaling error:', data.error);
        this.onErrorCallbacks.forEach(callback => callback(new Error(data.error)));
        break;

      default:
        console.log('Unknown message type:', type);
    }
  }

  // Handle WebRTC offer
  private async handleOffer(data: any): Promise<void> {
    try {
      if (!this.localPeerConnection) return;

      const { offer } = data;

      // Set remote description
      await this.localPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Create answer
      const answer = await this.localPeerConnection.createAnswer();
      await this.localPeerConnection.setLocalDescription(answer);

      // Send answer
      this.sendSignalingMessage('answer', {
        answer: this.localPeerConnection.localDescription,
      });

      console.log('Answer sent');
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }

  // Handle WebRTC answer
  private async handleAnswer(data: any): Promise<void> {
    try {
      if (!this.localPeerConnection) return;

      const { answer } = data;

      // Set remote description
      await this.localPeerConnection.setRemoteDescription(new RTCSessionDescription(answer));

      console.log('Answer received and set');
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }

  // Handle ICE candidate
  private async handleIceCandidate(data: any): Promise<void> {
    try {
      if (!this.localPeerConnection) return;

      const { candidate } = data;

      // Add ICE candidate
      await this.localPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));

      console.log('ICE candidate added');
    } catch (error) {
      console.error('Failed to handle ICE candidate:', error);
    }
  }

  // Send signaling message
  private async sendSignalingMessage(type: string, data: any): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error('Not connected to signaling server');
    }

    const message: WebRTCMessage = {
      type,
      data,
      timestamp: Date.now(),
    };

    this.socket.emit('message', message);
  }

  // Start call (for blind users)
  async startCall(): Promise<void> {
    if (this.currentUserType !== 'blind') {
      throw new Error('Only blind users can start calls');
    }

    if (!this.localPeerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      // Create offer
      const offer = await this.localPeerConnection.createOffer();
      await this.localPeerConnection.setLocalDescription(offer);

      // Send offer
      this.sendSignalingMessage('offer', {
        offer: this.localPeerConnection.localDescription,
      });

      this.isInitiator = true;

      console.log('Call started - offer sent');
    } catch (error) {
      console.error('Failed to start call:', error);
      throw error;
    }
  }

  // End call
  async endCall(reason: string = 'Call ended by user'): Promise<void> {
    try {
      // Send call end message
      this.sendSignalingMessage('call_status', {
        status: 'ended',
        reason,
      });

      // End API call
      if (this.currentRoomId) {
        await apiService.endCall(this.currentRoomId, reason);
      }

      // Clean up connections
      this.cleanup();

      console.log('Call ended');
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  }

  // Clean up WebRTC resources
  cleanup(): void {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.localPeerConnection) {
      this.localPeerConnection.close();
      this.localPeerConnection = null;
    }

    // Disconnect WebSocket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Clear state
    this.remoteStream = null;
    this.currentRoomId = null;
    this.isConnected = false;
    this.isInitiator = false;
    this.iceCandidates = [];

    console.log('WebRTC cleanup completed');
  }

  // Event listener methods
  onConnected(callback: () => void): void {
    this.onConnectedCallbacks.push(callback);
  }

  onDisconnected(callback: () => void): void {
    this.onDisconnectedCallbacks.push(callback);
  }

  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallbacks.push(callback);
  }

  onRoomStatus(callback: (status: string) => void): void {
    this.onRoomStatusCallbacks.push(callback);
  }

  // Remove event listeners
  removeEventListeners(): void {
    this.onConnectedCallbacks = [];
    this.onDisconnectedCallbacks = [];
    this.onRemoteStreamCallbacks = [];
    this.onErrorCallbacks = [];
    this.onRoomStatusCallbacks = [];
  }

  // Getters
  get isConnectedToServer(): boolean {
    return this.isConnected;
  }

  get localVideoStream(): MediaStream | null {
    return this.localStream;
  }

  get remoteVideoStream(): MediaStream | null {
    return this.remoteStream;
  }

  get currentRoom(): string | null {
    return this.currentRoomId;
  }

  // Toggle audio
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  // Toggle video
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  // Switch camera
  async switchCamera(): Promise<void> {
    if (!this.localStream) return;

    try {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack && 'switchCamera' in videoTrack) {
        // @ts-ignore
        await videoTrack.switchCamera();
      }
    } catch (error) {
      console.error('Failed to switch camera:', error);
    }
  }
}

// Export singleton instance
export const webrtcService = new WebRTCService();

// Export class for creating multiple instances if needed
export { WebRTCService };