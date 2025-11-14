import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  AccessibilityInfo,
} from 'react-native';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

interface WalletConnectProps {
  onWalletConnect: (walletAddress: string) => void;
  userType: 'blind' | 'volunteer';
}

const WalletConnect = ({ onWalletConnect, userType }: WalletConnectProps) => {
  const [connecting, setConnecting] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Initialize Solana connection
  const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');

  // Check if wallet is already connected on component mount
  useEffect(() => {
    checkExistingWallet();
  }, []);

  const checkExistingWallet = async () => {
    try {
      // In a real app, this would check for existing wallet connection
      // For now, we'll simulate checking local storage
      console.log('Checking for existing wallet connection...');
    } catch (error) {
      console.error('Error checking existing wallet:', error);
    }
  };

  const connectPhantomWallet = async () => {
    setConnecting(true);

    try {
      // In a real app, this would integrate with Phantom wallet
      // For now, we'll simulate the connection process

      // Simulate wallet connection delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate a mock wallet address for demonstration
      const mockPublicKey = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

      setWalletAddress(mockPublicKey);
      setWalletConnected(true);

      // Announce successful connection for accessibility
      AccessibilityInfo.announceForAccessibility('Wallet connected successfully');

      // Call parent callback
      onWalletConnect(mockPublicKey);

      Alert.alert(
        'Wallet Connected',
        `Successfully connected to Solana wallet: ${mockPublicKey.slice(0, 8)}...${mockPublicKey.slice(-8)}`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Wallet connection error:', error);

      AccessibilityInfo.announceForAccessibility('Wallet connection failed');

      Alert.alert(
        'Connection Failed',
        'Failed to connect to wallet. Please ensure you have a compatible Solana wallet installed.',
        [{ text: 'OK' }]
      );
    } finally {
      setConnecting(false);
    }
  };

  const connectSolflareWallet = async () => {
    setConnecting(true);

    try {
      // Similar to Phantom, this would integrate with Solflare wallet
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockPublicKey = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

      setWalletAddress(mockPublicKey);
      setWalletConnected(true);

      AccessibilityInfo.announceForAccessibility('Solflare wallet connected successfully');
      onWalletConnect(mockPublicKey);

      Alert.alert(
        'Wallet Connected',
        `Successfully connected to Solflare wallet: ${mockPublicKey.slice(0, 8)}...${mockPublicKey.slice(-8)}`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Solflare connection error:', error);

      AccessibilityInfo.announceForAccessibility('Solflare wallet connection failed');

      Alert.alert(
        'Connection Failed',
        'Failed to connect to Solflare wallet.',
        [{ text: 'OK' }]
      );
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress(null);

    AccessibilityInfo.announceForAccessibility('Wallet disconnected');

    Alert.alert('Wallet Disconnected', 'Your wallet has been disconnected.', [
      { text: 'OK' }
    ]);
  };

  const isVolunteer = userType === 'volunteer';
  const walletRequired = isVolunteer; // Wallet required for volunteers to track reputation

  const styles = StyleSheet.create({
    container: {
      width: '100%',
      marginVertical: 20,
    },
    header: {
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: '#ffffff',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: '#b0b0b0',
      lineHeight: 20,
    },
    requiredText: {
      color: '#ff6b6b',
      fontSize: 12,
      marginTop: 4,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    walletButton: {
      flex: 1,
      height: 56,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
      borderWidth: 1,
    },
    phantomButton: {
      backgroundColor: 'rgba(139, 92, 246, 0.2)',
      borderColor: '#8b5cf6',
    },
    solflareButton: {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      borderColor: '#10b981',
    },
    disconnectButton: {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
      borderColor: '#ef4444',
      height: 48,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    phantomButtonText: {
      color: '#8b5cf6',
    },
    solflareButtonText: {
      color: '#10b981',
    },
    disconnectButtonText: {
      color: '#ef4444',
    },
    buttonIcon: {
      fontSize: 20,
      marginRight: 8,
    },
    connectedStatus: {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    connectedText: {
      color: '#10b981',
      fontSize: 14,
      textAlign: 'center',
    },
    addressText: {
      color: '#ffffff',
      fontSize: 12,
      textAlign: 'center',
      marginTop: 4,
      fontFamily: 'monospace',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      color: '#b0b0b0',
      marginLeft: 8,
      fontSize: 16,
    },
  });

  if (walletConnected && walletAddress) {
    return (
      <View style={styles.container}>
        <View style={styles.connectedStatus}>
          <Text style={styles.connectedText}>✅ Wallet Connected</Text>
          <Text style={styles.addressText}>
            {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.walletButton, styles.disconnectButton]}
          onPress={disconnectWallet}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Disconnect wallet"
          accessibilityHint="Remove wallet connection from this app"
        >
          <Text style={[styles.buttonText, styles.disconnectButtonText]}>
            Disconnect Wallet
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Connect Solana Wallet {walletRequired && '*'}
        </Text>
        <Text style={styles.subtitle}>
          {isVolunteer
            ? 'Connect your wallet to track your on-chain reputation and receive rewards.'
            : 'Optional: Connect a wallet to receive rewards and view your contribution history.'
          }
        </Text>
        {walletRequired && (
          <Text style={styles.requiredText}>
            Wallet connection is required for volunteers to track reputation and receive rewards.
          </Text>
        )}
      </View>

      {connecting ? (
        <View style={[styles.walletButton, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.loadingText}>Connecting wallet...</Text>
          </View>
        </View>
      ) : (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.walletButton, styles.phantomButton]}
            onPress={connectPhantomWallet}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Connect Phantom wallet"
            accessibilityHint="Connect to Phantom Solana wallet"
          >
            <Text style={styles.buttonIcon}>👻</Text>
            <Text style={[styles.buttonText, styles.phantomButtonText]}>Phantom</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.walletButton, styles.solflareButton]}
            onPress={connectSolflareWallet}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Connect Solflare wallet"
            accessibilityHint="Connect to Solflare Solana wallet"
          >
            <Text style={styles.buttonIcon}>🔥</Text>
            <Text style={[styles.buttonText, styles.solflareButtonText]}>Solflare</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isVolunteer && (
        <Text style={styles.subtitle}>
          You can skip this step and connect a wallet later from your profile settings.
        </Text>
      )}
    </View>
  );
};

export default WalletConnect;