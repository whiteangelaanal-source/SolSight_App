import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  AccessibilityInfo,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/api';

interface Reward {
  id: string;
  amount: number;
  type: 'milestone' | 'airdrop' | 'bonus';
  description: string;
  timestamp: string;
  transactionHash?: string;
}

interface WalletInfo {
  address: string;
  balance: number;
  totalEarned: number;
}

const RewardsScreen = () => {
  const { user, walletAddress } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({
    address: walletAddress || '',
    balance: 0,
    totalEarned: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRewardsData();
  }, []);

  const loadRewardsData = async () => {
    try {
      setLoading(true);

      // Load rewards and blockchain info in parallel
      const [rewardsResponse, blockchainResponse] = await Promise.all([
        apiService.getUserRewards(50, 'all'), // Get up to 50 rewards
        apiService.getBlockchainInfo(),
      ]);

      const rewardsData = rewardsResponse.data?.rewards || [];
      const blockchainData = blockchainResponse.data;

      // Transform rewards data to expected format
      const transformedRewards: Reward[] = rewardsData.map((reward: any) => ({
        id: reward.id,
        amount: reward.amount,
        type: reward.type,
        description: reward.description,
        timestamp: reward.createdAt,
        transactionHash: reward.transactionHash,
      }));

      const totalEarned = transformedRewards.reduce((sum, reward) => sum + reward.amount, 0);

      setRewards(transformedRewards);
      setWalletInfo({
        address: walletAddress || '',
        balance: blockchainData.balance || 0,
        totalEarned,
      });

    } catch (error) {
      console.error('Error loading rewards:', error);
      Alert.alert('Error', 'Failed to load rewards data');

      // Set empty state on error
      setRewards([]);
      setWalletInfo({
        address: walletAddress || '',
        balance: 0,
        totalEarned: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWallet = () => {
    Alert.alert(
      'Connect Wallet',
      'Connect your Solana wallet to view rewards and receive tokens.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Connect', onPress: () => console.log('Connect wallet') },
      ]
    );
  };

  const handleViewTransaction = (hash: string) => {
    Alert.alert(
      'Transaction Details',
      `Transaction hash: ${hash}\n\nThis would open in a Solana block explorer.`,
      [{ text: 'OK' }]
    );
  };

  const getRewardTypeColor = (type: string) => {
    switch (type) {
      case 'milestone':
        return '#00d4ff';
      case 'airdrop':
        return '#9945ff';
      case 'bonus':
        return '#10b981';
      default:
        return '#b0b0b0';
    }
  };

  const getRewardTypeIcon = (type: string) => {
    switch (type) {
      case 'milestone':
        return '🎯';
      case 'airdrop':
        return '🎁';
      case 'bonus':
        return '⭐';
      default:
        return '💰';
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#1a1a2e',
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingVertical: 24,
    },
    walletCard: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    walletHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    walletTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#ffffff',
    },
    connectButton: {
      backgroundColor: '#00d4ff',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
    },
    connectButtonText: {
      color: '#ffffff',
      fontWeight: '600',
      fontSize: 14,
    },
    walletAddress: {
      fontSize: 14,
      color: '#b0b0b0',
      marginBottom: 16,
      fontFamily: 'monospace',
    },
    balanceGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    balanceItem: {
      flex: 1,
      alignItems: 'center',
    },
    balanceAmount: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#00d4ff',
      marginBottom: 4,
    },
    balanceLabel: {
      fontSize: 12,
      color: '#b0b0b0',
      textAlign: 'center',
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#ffffff',
      marginBottom: 16,
    },
    rewardItem: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rewardInfo: {
      flex: 1,
    },
    rewardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    rewardIcon: {
      fontSize: 20,
      marginRight: 8,
    },
    rewardDescription: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
      flex: 1,
    },
    rewardMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rewardType: {
      fontSize: 12,
      padding: 4,
      borderRadius: 4,
      overflow: 'hidden',
    },
    rewardTypeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    rewardDate: {
      fontSize: 12,
      color: '#888',
    },
    rewardAmount: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#00d4ff',
      marginLeft: 16,
    },
    transactionHash: {
      fontSize: 10,
      color: '#666',
      marginTop: 4,
      fontFamily: 'monospace',
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
    noWalletMessage: {
      textAlign: 'center',
      color: '#b0b0b0',
      fontSize: 16,
      marginBottom: 20,
      lineHeight: 24,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
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
        <Text>Loading rewards...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Wallet Information */}
      <View style={styles.walletCard}>
        <View style={styles.walletHeader}>
          <Text style={styles.walletTitle}>Wallet Information</Text>
          {!walletAddress && (
            <TouchableOpacity
              style={styles.connectButton}
              onPress={handleConnectWallet}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Connect wallet"
              accessibilityHint="Connect your Solana wallet to view rewards"
            >
              <Text style={styles.connectButtonText}>Connect Wallet</Text>
            </TouchableOpacity>
          )}
        </View>

        {walletAddress ? (
          <>
            <Text style={styles.walletAddress}>
              {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
            </Text>

            <View style={styles.balanceGrid}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceAmount}>{walletInfo.balance.toFixed(2)}</Text>
                <Text style={styles.balanceLabel}>Current Balance</Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceAmount}>{walletInfo.totalEarned.toFixed(2)}</Text>
                <Text style={styles.balanceLabel}>Total Earned</Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceAmount}>{rewards.length}</Text>
                <Text style={styles.balanceLabel}>Total Rewards</Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.noWalletMessage}>
            Connect your Solana wallet to view your rewards and transaction history.
          </Text>
        )}
      </View>

      {/* Rewards History */}
      {walletAddress && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rewards History</Text>

          {rewards.length > 0 ? (
            rewards.map((reward) => (
              <View key={reward.id} style={styles.rewardItem}>
                <View style={styles.rewardInfo}>
                  <View style={styles.rewardHeader}>
                    <Text style={styles.rewardIcon}>{getRewardTypeIcon(reward.type)}</Text>
                    <Text style={styles.rewardDescription}>{reward.description}</Text>
                  </View>

                  <View style={styles.rewardMeta}>
                    <View style={[styles.rewardType, { backgroundColor: getRewardTypeColor(reward.type) + '20' }]}>
                      <Text style={[styles.rewardTypeText, { color: getRewardTypeColor(reward.type) }]}>
                        {reward.type.charAt(0).toUpperCase() + reward.type.slice(1)}
                      </Text>
                    </View>
                    <Text style={styles.rewardDate}>
                      {new Date(reward.timestamp).toLocaleDateString()}
                    </Text>
                  </View>

                  {reward.transactionHash && (
                    <TouchableOpacity
                      onPress={() => handleViewTransaction(reward.transactionHash!)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="View transaction details"
                      accessibilityHint={`View transaction ${reward.transactionHash} on Solana explorer`}
                    >
                      <Text style={styles.transactionHash}>{reward.transactionHash}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.rewardAmount}>+{reward.amount} SOL</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No rewards yet. Complete more calls to earn rewards!
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

export default RewardsScreen;