import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  AccessibilityInfo,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';

interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  walletAddress: string;
  totalCalls: number;
  averageRating: number;
  reliabilityScore: number;
  reputationScore: number;
  avatar?: string;
  badge?: string;
}

type LeaderboardType = 'global' | 'monthly' | 'friends';

const LeaderboardScreen = () => {
  const { user } = useAuth();
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('global');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLeaderboardData();
  }, [leaderboardType]);

  const loadLeaderboardData = async () => {
    try {
      if (refreshing) setRefreshing(true);
      else setLoading(true);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockLeaderboard: LeaderboardEntry[] = [
        {
          id: '1',
          rank: 1,
          name: 'Sarah Chen',
          walletAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          totalCalls: 487,
          averageRating: 4.9,
          reliabilityScore: 99,
          reputationScore: 9850,
          avatar: '👩‍⚕️',
          badge: '🏆',
        },
        {
          id: '2',
          rank: 2,
          name: 'Mike Johnson',
          walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
          totalCalls: 423,
          averageRating: 4.8,
          reliabilityScore: 97,
          reputationScore: 8920,
          avatar: '👨‍⚕️',
          badge: '🥈',
        },
        {
          id: '3',
          rank: 3,
          name: 'Emily Davis',
          walletAddress: '5KbpLsBHa9k4rsJGMnUJ8qVb6Jh8zN4kK9xT8qVb6J',
          totalCalls: 389,
          averageRating: 4.7,
          reliabilityScore: 95,
          reputationScore: 7980,
          avatar: '👩‍⚕️',
          badge: '🥉',
        },
        {
          id: '4',
          rank: 4,
          name: 'David Lee',
          walletAddress: '3FzWp2BHa9k4rsJGMnUJ8qVb6Jh8zN4kK9xT8qVb6J',
          totalCalls: 356,
          averageRating: 4.6,
          reliabilityScore: 94,
          reputationScore: 7230,
          avatar: '👨‍⚕️',
        },
        {
          id: '5',
          rank: 5,
          name: 'Lisa Wang',
          walletAddress: '2GyVp1BHa9k4rsJGMnUJ8qVb6Jh8zN4kK9xT8qVb6J',
          totalCalls: 298,
          averageRating: 4.5,
          reliabilityScore: 92,
          reputationScore: 6540,
          avatar: '👩‍⚕️',
        },
        // Add more entries
        {
          id: '6',
          rank: 15,
          name: user?.name || 'You',
          walletAddress: user?.walletAddress || '',
          totalCalls: 42,
          averageRating: 4.8,
          reliabilityScore: 96,
          reputationScore: 1240,
          avatar: '🎯',
        },
      ];

      setLeaderboard(mockLeaderboard);

    } catch (error) {
      console.error('Error loading leaderboard:', error);
      Alert.alert('Error', 'Failed to load leaderboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadLeaderboardData();
  };

  const handleViewProfile = (entry: LeaderboardEntry) => {
    Alert.alert(
      'Volunteer Profile',
      `${entry.name}\n\n📞 Calls: ${entry.totalCalls}\n⭐ Rating: ${entry.averageRating}/5\n📊 Reliability: ${entry.reliabilityScore}%\n🏆 Reputation: ${entry.reputationScore}`,
      [{ text: 'OK' }]
    );
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return '#FFD700'; // Gold
      case 2:
        return '#C0C0C0'; // Silver
      case 3:
        return '#CD7F32'; // Bronze
      default:
        return '#666'; // Gray
    }
  };

  const getRankSuffix = (rank: number) => {
    if (rank === 1) return 'st';
    if (rank === 2) return 'nd';
    if (rank === 3) return 'rd';
    return 'th';
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#1a1a2e',
    },
    content: {
      flex: 1,
    },
    header: {
      paddingHorizontal: 24,
      paddingVertical: 20,
      backgroundColor: '#16213e',
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 16,
    },
    typeSelector: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 12,
      padding: 4,
    },
    typeButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      alignItems: 'center',
    },
    typeButtonActive: {
      backgroundColor: '#00d4ff',
    },
    typeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#b0b0b0',
    },
    typeButtonTextActive: {
      color: '#ffffff',
    },
    listContainer: {
      flex: 1,
      paddingHorizontal: 24,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    ownItem: {
      backgroundColor: 'rgba(0, 212, 255, 0.1)',
      borderWidth: 1,
      borderColor: '#00d4ff',
    },
    rankBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    rankNumber: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#00d4ff',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    avatarText: {
      fontSize: 20,
    },
    userInfo: {
      flex: 1,
    },
    userName: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
      marginBottom: 4,
      flexDirection: 'row',
      alignItems: 'center',
    },
    userStats: {
      fontSize: 14,
      color: '#b0b0b0',
    },
    badge: {
      fontSize: 16,
      marginLeft: 8,
    },
    reputation: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#00d4ff',
      textAlign: 'right',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: '#b0b0b0',
      marginTop: 16,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    emptyStateText: {
      fontSize: 16,
      color: '#b0b0b0',
      textAlign: 'center',
      marginBottom: 20,
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🏆 Leaderboard</Text>

        <View style={styles.typeSelector}>
          {(['global', 'monthly', 'friends'] as LeaderboardType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeButton,
                leaderboardType === type && styles.typeButtonActive,
              ]}
              onPress={() => setLeaderboardType(type)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${type} leaderboard`}
              accessibilityHint={`View ${type} rankings of volunteers`}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  leaderboardType === type && styles.typeButtonTextActive,
                ]}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Leaderboard List */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {leaderboard.map((entry) => (
          <TouchableOpacity
            key={entry.id}
            style={[
              styles.listItem,
              entry.name === user?.name && styles.ownItem,
            ]}
            onPress={() => handleViewProfile(entry)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`${entry.name}, rank ${entry.rank}`}
            accessibilityHint={`View ${entry.name}'s profile details`}
          >
            {/* Rank Badge */}
            <View
              style={[
                styles.rankBadge,
                { backgroundColor: getRankBadgeColor(entry.rank) },
              ]}
            >
              {entry.rank <= 3 ? (
                <Text style={styles.badge}>
                  {entry.badge}
                </Text>
              ) : (
                <Text style={[styles.rankNumber]}>
                  {entry.rank}
                </Text>
              )}
            </View>

            {/* Avatar */}
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {entry.avatar || '👤'}
              </Text>
            </View>

            {/* User Info */}
            <View style={styles.userInfo}>
              <View style={styles.userName}>
                <Text>{entry.name}</Text>
                {entry.name === user?.name && (
                  <Text style={styles.badge}>🎯</Text>
                )}
              </View>
              <Text style={styles.userStats}>
                📞 {entry.totalCalls} calls • ⭐ {entry.averageRating}/5 • 📊 {entry.reliabilityScore}%
              </Text>
            </View>

            {/* Reputation Score */}
            <View style={styles.reputation}>
              <Text>{entry.reputationScore.toLocaleString()}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default LeaderboardScreen;