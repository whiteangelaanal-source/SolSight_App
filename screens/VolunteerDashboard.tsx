import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  AccessibilityInfo,
  StatusBar,
  Switch,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/api';

interface IncomingCall {
  id: string;
  userName: string;
  userPhoto?: string;
  helpReason: string;
  timestamp: string;
}

interface Reputation {
  totalCalls: number;
  averageRating: number;
  reliabilityScore: number;
  lastUpdated: string;
}

interface Reward {
  id: string;
  amount: number;
  type: 'milestone' | 'airdrop' | 'bonus';
  description: string;
  timestamp: string;
}

const VolunteerDashboard = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [hasIncomingCall, setHasIncomingCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [reputation, setReputation] = useState<Reputation>({
    totalCalls: 0,
    averageRating: 0,
    reliabilityScore: 0,
    lastUpdated: '',
  });
  const [recentRewards, setRecentRewards] = useState<Reward[]>([]);

  useEffect(() => {
    loadVolunteerData();
  }, []);

  useEffect(() => {
    // Simulate incoming call after 5 seconds for demo
    if (isOnline) {
      const timer = setTimeout(() => {
        simulateIncomingCall();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  const loadVolunteerData = async () => {
    try {
      // Load user stats including reputation data
      const [statsResponse, rewardsResponse] = await Promise.all([
        apiService.getUserStats(),
        apiService.getUserRewards(3, 'all'), // Get last 3 rewards
      ]);

      const statsData = statsResponse.data;
      const rewardsData = rewardsResponse.data?.rewards || [];

      // Set reputation from user stats
      setReputation({
        totalCalls: statsData.totalCalls || 0,
        averageRating: statsData.averageRating || 0,
        reliabilityScore: statsData.reliabilityScore || 0,
        lastUpdated: statsData.lastUpdated || new Date().toISOString(),
      });

      // Transform rewards data to expected format
      const transformedRewards: Reward[] = rewardsData.map((reward: any) => ({
        id: reward.id,
        amount: reward.amount,
        type: reward.type,
        description: reward.description,
        timestamp: reward.createdAt,
      }));

      setRecentRewards(transformedRewards);

    } catch (error) {
      console.error('Error loading volunteer data:', error);
      // Set default values on error
      setReputation({
        totalCalls: 0,
        averageRating: 0,
        reliabilityScore: 0,
        lastUpdated: new Date().toISOString(),
      });
      setRecentRewards([]);
    }
  };

  const simulateIncomingCall = () => {
    const mockCall: IncomingCall = {
      id: `call_${Date.now()}`,
      userName: 'Alex Martinez',
      helpReason: 'Need help reading medication labels',
      timestamp: new Date().toISOString(),
    };

    setIncomingCall(mockCall);
    setHasIncomingCall(true);

    // Announce for accessibility
    AccessibilityInfo.announceForAccessibility(
      `Incoming help request from ${mockCall.userName}: ${mockCall.helpReason}`
    );
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;

    AccessibilityInfo.announceForAccessibility('Accepting call, connecting to user');

    setHasIncomingCall(false);
    setIncomingCall(null);

    // Navigate to video call
    navigation.navigate('VideoCall', {
      isBlindUser: false,
      sessionId: incomingCall.id,
      userName: incomingCall.userName,
    });
  };

  const handleDeclineCall = () => {
    AccessibilityInfo.announceForAccessibility('Call declined');

    setHasIncomingCall(false);
    setIncomingCall(null);
  };

  const handleOnlineToggle = async (value: boolean) => {
    try {
      setIsOnline(value);

      // Update availability on backend
      await apiService.updateAvailability(value);

      AccessibilityInfo.announceForAvailabilityChange(
        value ? 'You are now online and available to help' : 'You are now offline'
      );
    } catch (error) {
      console.error('Error updating availability:', error);
      // Revert state on error
      setIsOnline(!value);

      Alert.alert(
        'Update Failed',
        'Unable to update your availability status. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You will no longer receive help requests.',
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

  const handleViewRewards = () => {
    navigation.navigate('Rewards');
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Text key={i} style={[styles.star, i < rating && styles.starFilled]}>
        {i < rating ? '⭐' : '☆'}
      </Text>
    ));
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#1a1a2e',
    },
    header: {
      paddingTop: StatusBar.currentHeight || 44,
      paddingHorizontal: 24,
      paddingBottom: 20,
      backgroundColor: '#16213e',
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
      paddingVertical: 24,
    },
    statusSection: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    statusInfo: {
      flex: 1,
    },
    statusLabel: {
      fontSize: 16,
      color: '#b0b0b0',
      marginBottom: 8,
    },
    statusValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    onlineStatus: {
      color: isOnline ? '#10b981' : '#ef4444',
    },
    reputationSection: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#ffffff',
      marginBottom: 16,
    },
    reputationGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    reputationItem: {
      flex: 1,
      alignItems: 'center',
    },
    reputationNumber: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#00d4ff',
      marginBottom: 4,
    },
    reputationLabel: {
      fontSize: 14,
      color: '#b0b0b0',
      textAlign: 'center',
    },
    ratingContainer: {
      flexDirection: 'row',
      marginTop: 8,
    },
    rewardsSection: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    rewardItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    rewardInfo: {
      flex: 1,
    },
    rewardDescription: {
      fontSize: 16,
      color: '#ffffff',
      marginBottom: 4,
    },
    rewardType: {
      fontSize: 12,
      color: '#b0b0b0',
    },
    rewardAmount: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#00d4ff',
    },
    viewAllButton: {
      marginTop: 16,
      backgroundColor: 'rgba(0, 212, 255, 0.2)',
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    viewAllButtonText: {
      fontSize: 16,
      color: '#00d4ff',
      fontWeight: '600',
    },
    incomingCallModal: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    incomingCallContent: {
      backgroundColor: '#16213e',
      borderRadius: 20,
      padding: 32,
      width: '90%',
      maxWidth: 400,
      alignItems: 'center',
    },
    callerAvatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#00d4ff',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    avatarText: {
      fontSize: 32,
      color: '#ffffff',
      fontWeight: 'bold',
    },
    callerName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 8,
      textAlign: 'center',
    },
    callReason: {
      fontSize: 16,
      color: '#b0b0b0',
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 22,
    },
    callActions: {
      flexDirection: 'row',
      gap: 16,
      width: '100%',
    },
    callButton: {
      flex: 1,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
    },
    acceptButton: {
      backgroundColor: '#10b981',
    },
    declineButton: {
      backgroundColor: '#ef4444',
    },
    callButtonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#ffffff',
    },
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>
            Welcome back, {user?.name || 'Volunteer'}! 👋
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleViewRewards}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="View rewards"
              accessibilityHint="Check your rewards and transaction history"
            >
              <Text style={{ fontSize: 20, color: '#ffffff' }}>🏆</Text>
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

      <ScrollView style={styles.content}>
        {/* Online Status */}
        <View style={styles.statusSection}>
          <View style={styles.statusInfo}>
            <Text style={styles.statusLabel}>Availability Status</Text>
            <Text style={[styles.statusValue, styles.onlineStatus]}>
              {isOnline ? '🟢 Online' : '🔴 Offline'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleOnlineToggle}
            trackColor={{ false: '#ef4444', true: '#10b981' }}
            thumbColor="#ffffff"
            accessibilityLabel="Online status"
            accessibilityHint="Toggle your availability to receive help requests"
          />
        </View>

        {/* Reputation Stats */}
        <View style={styles.reputationSection}>
          <Text style={styles.sectionTitle}>Your Reputation</Text>
          <View style={styles.reputationGrid}>
            <View style={styles.reputationItem}>
              <Text style={styles.reputationNumber}>{reputation.totalCalls}</Text>
              <Text style={styles.reputationLabel}>Total Calls</Text>
            </View>
            <View style={styles.reputationItem}>
              <View>
                <Text style={styles.reputationNumber}>{reputation.averageRating.toFixed(1)}</Text>
                <View style={styles.ratingContainer}>
                  {renderStars(Math.round(reputation.averageRating))}
                </View>
              </View>
              <Text style={styles.reputationLabel}>Average Rating</Text>
            </View>
            <View style={styles.reputationItem}>
              <Text style={styles.reputationNumber}>{reputation.reliabilityScore}%</Text>
              <Text style={styles.reputationLabel}>Reliability</Text>
            </View>
          </View>
        </View>

        {/* Recent Rewards */}
        <View style={styles.rewardsSection}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>Recent Rewards</Text>
            <Text style={{ fontSize: 14, color: '#00d4ff' }}>
              Total: {recentRewards.reduce((sum, r) => sum + r.amount, 0).toFixed(2)} SOL
            </Text>
          </View>

          {recentRewards.slice(0, 3).map((reward) => (
            <View key={reward.id} style={styles.rewardItem}>
              <View style={styles.rewardInfo}>
                <Text style={styles.rewardDescription}>{reward.description}</Text>
                <Text style={styles.rewardType}>
                  {reward.type} • {new Date(reward.timestamp).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.rewardAmount}>+{reward.amount} SOL</Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={handleViewRewards}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="View all rewards"
            accessibilityHint="See complete rewards and transaction history"
          >
            <Text style={styles.viewAllButtonText}>View All Rewards →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Incoming Call Modal */}
      {hasIncomingCall && incomingCall && (
        <View style={styles.incomingCallModal}>
          <View style={styles.incomingCallContent}>
            <View style={styles.callerAvatar}>
              <Text style={styles.avatarText}>
                {incomingCall.userName.charAt(0).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.callerName}>{incomingCall.userName}</Text>
            <Text style={styles.callReason}>{incomingCall.helpReason}</Text>

            <View style={styles.callActions}>
              <TouchableOpacity
                style={[styles.callButton, styles.declineButton]}
                onPress={handleDeclineCall}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Decline call"
                accessibilityHint="Reject this help request"
              >
                <Text style={styles.callButtonText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.callButton, styles.acceptButton]}
                onPress={handleAcceptCall}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Accept call"
                accessibilityHint="Accept this help request and start video call"
              >
                <Text style={styles.callButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default VolunteerDashboard;