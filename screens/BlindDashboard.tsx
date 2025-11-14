import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  AccessibilityInfo,
  StatusBar,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';

interface HelpSession {
  id: string;
  volunteerName: string;
  duration: number;
  rating?: number;
  timestamp: string;
}

const BlindDashboard = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [isRequestingHelp, setIsRequestingHelp] = useState(false);
  const [recentHelpers, setRecentHelpers] = useState<HelpSession[]>([]);
  const [helpHistory, setHelpHistory] = useState<HelpSession[]>([]);

  useEffect(() => {
    loadHelpHistory();
  }, []);

  const loadHelpHistory = async () => {
    try {
      // Simulate loading help history
      const mockHistory: HelpSession[] = [
        {
          id: '1',
          volunteerName: 'Sarah Chen',
          duration: 12,
          rating: 5,
          timestamp: '2024-01-15T10:30:00Z',
        },
        {
          id: '2',
          volunteerName: 'Mike Johnson',
          duration: 8,
          rating: 4,
          timestamp: '2024-01-14T15:45:00Z',
        },
      ];

      const mockRecent = mockHistory.slice(0, 3);
      setRecentHelpers(mockRecent);
      setHelpHistory(mockHistory);
    } catch (error) {
      console.error('Error loading help history:', error);
    }
  };

  const handleRequestHelp = async () => {
    setIsRequestingHelp(true);

    try {
      // Announce request for accessibility
      AccessibilityInfo.announceForAccessibility('Requesting help from volunteers');

      // Simulate matching with volunteer
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Simulate volunteer found
      AccessibilityInfo.announceForAccessibility('Volunteer found, connecting to video call');

      // Navigate to video call
      navigation.navigate('VideoCall', {
        isBlindUser: true,
        sessionId: `session_${Date.now()}`,
        volunteerName: 'Available Volunteer',
      });

    } catch (error) {
      console.error('Error requesting help:', error);

      AccessibilityInfo.announceForAccessibility('Failed to connect with volunteer');

      Alert.alert(
        'Connection Failed',
        'Unable to connect with a volunteer right now. Please try again in a moment.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRequestingHelp(false);
    }
  };

  const handleVoiceCommand = () => {
    // In a real app, this would trigger voice recognition
    AccessibilityInfo.announceForAccessibility('Voice command activated. Say your command.');
    Alert.alert(
      'Voice Commands',
      'Available commands:\n\n• "Get help" - Request assistance\n• "Show history" - View help history\n• "Rate helper" - Rate last volunteer\n• "End call" - End current call',
      [{ text: 'OK' }]
    );
  };

  const handleRateHelper = (sessionId: string, rating: number) => {
    // Update rating in recent helpers
    setRecentHelpers(prev =>
      prev.map(session =>
        session.id === sessionId ? { ...session, rating } : session
      )
    );

    AccessibilityInfo.announceForAccessibility(`Rated helper ${rating} stars`);

    Alert.alert(
      'Thank You!',
      'Your feedback helps us improve our service and recognizes our volunteers.',
      [{ text: 'OK' }]
    );
  };

  const handleReconnect = (volunteerName: string) => {
    Alert.alert(
      'Reconnect',
      `Would you like to request help from ${volunteerName} again?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: () => handleRequestHelp(),
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            logout();
            AccessibilityInfo.announceForAccessibility('Signed out successfully');
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0f1419',
    },
    header: {
      paddingTop: StatusBar.currentHeight || 44,
      paddingHorizontal: 24,
      paddingBottom: 20,
      backgroundColor: '#1a1a2e',
    },
    headerContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    greeting: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    headerButtons: {
      flexDirection: 'row',
      gap: 16,
    },
    headerButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    helpButton: {
      width: 240,
      height: 240,
      borderRadius: 120,
      backgroundColor: '#00d4ff',
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginBottom: 40,
      // Pulsing animation
      shadowColor: '#00d4ff',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 20,
      elevation: 20,
    },
    helpButtonPressed: {
      backgroundColor: '#00a8cc',
      transform: [{ scale: 0.95 }],
    },
    helpButtonText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#ffffff',
      textAlign: 'center',
      marginBottom: 8,
    },
    helpButtonSubtext: {
      fontSize: 16,
      color: '#ffffff',
      opacity: 0.9,
      textAlign: 'center',
    },
    voiceCommandHint: {
      textAlign: 'center',
      color: '#b0b0b0',
      fontSize: 14,
      marginBottom: 32,
    },
    section: {
      marginBottom: 32,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: '#ffffff',
      marginBottom: 16,
    },
    helperCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    helperInfo: {
      flex: 1,
    },
    helperName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
      marginBottom: 4,
    },
    helperMeta: {
      fontSize: 14,
      color: '#b0b0b0',
    },
    helperActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    actionButtonText: {
      fontSize: 14,
      color: '#00d4ff',
    },
    ratingContainer: {
      flexDirection: 'row',
      gap: 4,
    },
    starButton: {
      fontSize: 20,
      color: '#444',
    },
    starFilled: {
      color: '#ffd700',
    },
    historyItem: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    historyName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
    historyDuration: {
      fontSize: 14,
      color: '#b0b0b0',
    },
    historyTime: {
      fontSize: 12,
      color: '#888',
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: '#ffffff',
      fontSize: 18,
      marginTop: 16,
    },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>
            Hello, {user?.name || 'User'}! 👋
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleVoiceCommand}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Voice commands"
              accessibilityHint="Use voice commands to control the app"
            >
              <Text style={{ fontSize: 20, color: '#ffffff' }}>🎤</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleLogout}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              accessibilityHint="Sign out of your account"
            >
              <Text style={{ fontSize: 20, color: '#ffffff' }}>🚪</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Request Help Button */}
        <TouchableOpacity
          style={[styles.helpButton, isRequestingHelp && styles.helpButtonPressed]}
          onPress={handleRequestHelp}
          disabled={isRequestingHelp}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Request help"
          accessibilityHint={isRequestingHelp ? "Finding a volunteer..." : "Tap to request help from available volunteers"}
        >
          {isRequestingHelp ? (
            <View>
              <Text style={styles.helpButtonText}>Finding Volunteer...</Text>
              <Text style={styles.helpButtonSubtext}>Please wait</Text>
            </View>
          ) : (
            <View>
              <Text style={styles.helpButtonText}>Request Help</Text>
              <Text style={styles.helpButtonSubtext}>Tap to connect</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.voiceCommandHint}>
          💬 Say "Hey SolSight, get help" to use voice commands
        </Text>

        {/* Recent Helpers */}
        {recentHelpers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Helpers</Text>
            {recentHelpers.map((session) => (
              <View key={session.id} style={styles.helperCard}>
                <View style={styles.helperInfo}>
                  <Text style={styles.helperName}>{session.volunteerName}</Text>
                  <Text style={styles.helperMeta}>
                    {session.duration} minutes • {new Date(session.timestamp).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.helperActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleReconnect(session.volunteerName)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Reconnect with ${session.volunteerName}`}
                  >
                    <Text style={styles.actionButtonText}>Reconnect</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Help History */}
        {helpHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Help History</Text>
            {helpHistory.slice(0, 3).map((session) => (
              <View key={session.id} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyName}>{session.volunteerName}</Text>
                  <Text style={styles.historyDuration}>{session.duration} min</Text>
                </View>
                <Text style={styles.historyTime}>
                  {new Date(session.timestamp).toLocaleString()}
                </Text>
                {session.rating && (
                  <View style={styles.ratingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => handleRateHelper(session.id, star)}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel={`Rate ${star} stars`}
                        accessibilityHint={`Give this helper ${star} star rating`}
                      >
                        <Text
                          style={[
                            styles.starButton,
                            star <= session.rating && styles.starFilled
                          ]}
                        >
                          {star <= session.rating ? '⭐' : '☆'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Loading Overlay */}
      {isRequestingHelp && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Connecting with volunteer...</Text>
        </View>
      )}
    </View>
  );
};

export default BlindDashboard;