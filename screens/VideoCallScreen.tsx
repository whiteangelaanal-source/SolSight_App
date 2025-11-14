import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  AccessibilityInfo,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/api';

const { width, height } = Dimensions.get('window');

interface VideoCallScreenProps {
  // Props will be passed via navigation route params
}

const VideoCallScreen: React.FC<VideoCallScreenProps> = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isBlindUser, sessionId, userName, volunteerName } = route.params || {};

  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const callTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    initializeCall();
    return () => {
      endCall();
    };
  }, []);

  useEffect(() => {
    if (isConnected) {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [isConnected]);

  const initializeCall = async () => {
    try {
      AccessibilityInfo.announceForAvailabilityChange('Initializing video call...');

      // Simulate WebRTC connection setup
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In a real app, this would:
      // 1. Request camera and microphone permissions
      // 2. Initialize WebRTC peer connection
      // 3. Connect to signaling server
      // 4. Exchange ICE candidates
      // 5. Establish media streams

      setIsConnected(true);
      AccessibilityInfo.announceForAvailabilityChange('Call connected successfully');

    } catch (error) {
      console.error('Error initializing call:', error);
      AccessibilityInfo.announceForAvailabilityChange('Failed to connect call');

      Alert.alert(
        'Connection Failed',
        'Unable to establish video connection. Please check your internet connection and try again.',
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );
    }
  };

  const endCall = () => {
    setIsConnected(false);

    // Clean up WebRTC resources
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }

    // Stop timer
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }

    AccessibilityInfo.announceForAvailabilityChange('Call ended');

    // Navigate back
    navigation.goBack();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    AccessibilityInfo.announceForAvailabilityChange(
      isMuted ? 'Microphone unmuted' : 'Microphone muted'
    );
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    AccessibilityInfo.announceForAvailabilityChange(
      isSpeakerOn ? 'Speaker off' : 'Speaker on'
    );
  };

  const toggleCamera = () => {
    setIsFrontCamera(!isFrontCamera);
    AccessibilityInfo.announceForAvailabilityChange(
      isFrontCamera ? 'Switching to back camera' : 'Switching to front camera'
    );
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const displayName = isBlindUser ? volunteerName : userName;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    remoteVideo: {
      flex: 1,
      backgroundColor: '#1a1a2e',
      justifyContent: 'center',
      alignItems: 'center',
    },
    remoteVideoPlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      fontSize: 48,
      color: '#ffffff',
      fontWeight: 'bold',
      marginBottom: 16,
    },
    remoteName: {
      fontSize: 24,
      color: '#ffffff',
      marginBottom: 8,
    },
    connectionStatus: {
      fontSize: 16,
      color: '#b0b0b0',
    },
    localVideo: {
      position: 'absolute',
      top: 100,
      right: 20,
      width: 120,
      height: 160,
      backgroundColor: '#1a1a2e',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: '#00d4ff',
      justifyContent: 'center',
      alignItems: 'center',
    },
    controlsContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    callInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    callerName: {
      fontSize: 18,
      color: '#ffffff',
      fontWeight: '600',
    },
    callTimer: {
      fontSize: 16,
      color: '#00d4ff',
      fontFamily: 'monospace',
    },
    controls: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    controlButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    controlButtonActive: {
      backgroundColor: '#00d4ff',
    },
    controlButtonDanger: {
      backgroundColor: '#ef4444',
    },
    controlButtonText: {
      fontSize: 24,
      color: '#ffffff',
    },
    accessibilityButton: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      position: 'absolute',
      top: 100,
      left: 20,
    },
    helpText: {
      fontSize: 12,
      color: '#ffffff',
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* Remote Video Stream */}
      <View style={styles.remoteVideo}>
        {!isConnected ? (
          <View style={styles.remoteVideoPlaceholder}>
            <Text style={styles.avatarText}>
              {displayName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
            <Text style={styles.remoteName}>{displayName || 'Connecting...'}</Text>
            <Text style={styles.connectionStatus}>
              {!isConnected ? 'Connecting...' : 'Connected'}
            </Text>
          </View>
        ) : (
          // In a real app, this would render the remote video stream
          <View style={styles.remoteVideoPlaceholder}>
            <Text style={styles.connectionStatus}>Video stream active</Text>
          </View>
        )}
      </View>

      {/* Local Video (Picture-in-Picture) */}
      <View style={styles.localVideo}>
        <Text style={styles.avatarText}>
          {user?.name?.charAt(0)?.toUpperCase() || 'Y'}
        </Text>
      </View>

      {/* Accessibility Help Button */}
      <TouchableOpacity
        style={styles.accessibilityButton}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Accessibility help"
        accessibilityHint="Get help with call controls"
        onPress={() => {
          Alert.alert(
            'Call Controls',
            'Available controls:\n\n• Mute/Unmute microphone\n• Toggle speaker\n• Switch camera\n• End call\n\nVoice commands are also available during calls.',
            [{ text: 'OK' }]
          );
        }}
      >
        <Text style={styles.helpText}>?</Text>
      </TouchableOpacity>

      {/* Call Controls */}
      <View style={styles.controlsContainer}>
        {/* Call Info */}
        <View style={styles.callInfo}>
          <Text style={styles.callerName}>{displayName || 'Unknown'}</Text>
          <Text style={styles.callTimer}>{formatDuration(callDuration)}</Text>
        </View>

        {/* Control Buttons */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={toggleMute}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? "Unmute microphone" : "Mute microphone"}
            accessibilityHint={isMuted ? "Turn on your microphone" : "Turn off your microphone"}
          >
            <Text style={styles.controlButtonText}>
              {isMuted ? '🎤' : '🔇'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
            onPress={toggleSpeaker}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={isSpeakerOn ? "Turn off speaker" : "Turn on speaker"}
            accessibilityHint={isSpeakerOn ? "Switch to earpiece" : "Switch to loudspeaker"}
          >
            <Text style={styles.controlButtonText}>
              {isSpeakerOn ? '🔊' : '🔉'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={toggleCamera}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Switch camera"
            accessibilityHint="Switch between front and back camera"
          >
            <Text style={styles.controlButtonText}>
              {isFrontCamera ? '🔄' : '🔄'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.controlButtonDanger]}
            onPress={endCall}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="End call"
            accessibilityHint="End the current video call"
          >
            <Text style={styles.controlButtonText}>📞</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default VideoCallScreen;