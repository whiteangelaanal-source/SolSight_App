import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { apiService } from '../../services/api';

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  database: {
    status: string;
    responseTime: number;
    connections: number;
    lastCheck: string;
  };
  websocket: {
    status: string;
    activeConnections: number;
    maxConnections: number;
    lastCheck: string;
  };
  blockchain: {
    status: string;
    network: string;
    blockHeight: number;
    lastCheck: string;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    uptime: number;
    responseTime: number;
  };
  timestamp: string;
}

const SystemStatus = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [healthData, setHealthData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSystemHealth();
  }, []);

  const loadSystemHealth = async () => {
    try {
      setLoading(true);

      const response = await apiService.request('/admin/system/health');
      setHealthData(response.data);

    } catch (error) {
      console.error('Error loading system health:', error);
      Alert.alert(
        'Error',
        'Failed to load system health data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSystemHealth();
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'degraded': return '#f59e0b';
      case 'down': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'down': return '❌';
      default: return '❓';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const renderHealthCard = (
    title: string,
    status: string,
    details: any,
    color: string
  ) => (
    <View style={[styles.healthCard, { borderColor: color }]}>
      <View style={styles.healthHeader}>
        <Text style={styles.healthTitle}>{title}</Text>
        <View style={styles.healthStatus}>
          <Text style={styles.healthIcon}>{getHealthIcon(status)}</Text>
          <Text style={[styles.healthStatusText, { color }]}>
            {status.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.healthDetails}>
        {Object.entries(details).map(([key, value]) => (
          <View key={key} style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {key.replace(/([A-Z])/g, ' $1').trim()}:
            </Text>
            <Text style={styles.detailValue}>
              {typeof value === 'number' ?
                (key.includes('Usage') ? `${value}%` :
                 key.includes('Time') ? `${value}ms` : value.toString()) :
                value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading system status...</Text>
      </View>
    );
  }

  if (!healthData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load system health data</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#1a237e" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>System Status</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#00d4ff']}
          />
        }
      >
        {/* Overall Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall System Status</Text>
          <View style={styles.overallStatusCard}>
            <View style={styles.overallStatusHeader}>
              <Text style={styles.overallStatusTitle}>System Health</Text>
              <Text style={styles.lastUpdated}>
                Last updated: {new Date(healthData.timestamp).toLocaleString()}
              </Text>
            </View>
            <View style={styles.overallStatusIndicator}>
              <Text style={[styles.overallStatusText, { color: getHealthColor(healthData.overall) }]}>
                {getHealthIcon(healthData.overall)} {healthData.overall.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Database Health */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Database Status</Text>
          {renderHealthCard(
            'Database Connection',
            healthData.database.status,
            {
              'Response Time': healthData.database.responseTime,
              'Active Connections': healthData.database.connections,
              'Last Check': new Date(healthData.database.lastCheck).toLocaleTimeString(),
            },
            getHealthColor(healthData.database.status)
          )}
        </View>

        {/* WebSocket Health */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WebSocket Server</Text>
          {renderHealthCard(
            'Real-time Connections',
            healthData.websocket.status,
            {
              'Active Connections': healthData.websocket.activeConnections,
              'Max Connections': healthData.websocket.maxConnections,
              'Last Check': new Date(healthData.websocket.lastCheck).toLocaleTimeString(),
            },
            getHealthColor(healthData.websocket.status)
          )}
        </View>

        {/* Blockchain Health */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Blockchain Service</Text>
          {renderHealthCard(
            'Solana Network',
            healthData.blockchain.status,
            {
              'Network': healthData.blockchain.network,
              'Block Height': healthData.blockchain.blockHeight,
              'Last Check': new Date(healthData.blockchain.lastCheck).toLocaleTimeString(),
            },
            getHealthColor(healthData.blockchain.status)
          )}
        </View>

        {/* System Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Performance</Text>
          <View style={styles.performanceCard}>
            <View style={styles.performanceGrid}>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>CPU Usage</Text>
                <Text style={styles.performanceValue}>
                  {healthData.system.cpuUsage}%
                </Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>Memory Usage</Text>
                <Text style={styles.performanceValue}>
                  {healthData.system.memoryUsage}%
                </Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>Disk Usage</Text>
                <Text style={styles.performanceValue}>
                  {healthData.system.diskUsage}%
                </Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>API Response Time</Text>
                <Text style={styles.performanceValue}>
                  {healthData.system.responseTime}ms
                </Text>
              </View>
            </View>
            <View style={styles.uptimeItem}>
              <Text style={styles.uptimeLabel}>System Uptime</Text>
              <Text style={styles.uptimeValue}>
                {formatUptime(healthData.system.uptime)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1a237e',
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 16,
  },
  overallStatusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overallStatusHeader: {
    flex: 1,
  },
  overallStatusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#666666',
  },
  overallStatusIndicator: {
    alignItems: 'flex-end',
  },
  overallStatusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  healthCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  healthStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  healthStatusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  healthDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a2e',
  },
  performanceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  performanceItem: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  performanceLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
    textAlign: 'center',
  },
  performanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  uptimeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  uptimeLabel: {
    fontSize: 14,
    color: '#666666',
  },
  uptimeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
});

export default SystemStatus;