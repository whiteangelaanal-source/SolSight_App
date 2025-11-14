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

interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;
  totalCalls: number;
  activeCalls: number;
  systemHealth: 'healthy' | 'degraded' | 'down';
  averageResponseTime: number;
  newUsersToday: number;
  callsToday: number;
}

interface RecentActivity {
  id: string;
  type: 'user_signup' | 'call_completed' | 'user_banned' | 'system_alert';
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}

const AdminDashboard = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<AdminMetrics>({
    totalUsers: 0,
    activeUsers: 0,
    totalCalls: 0,
    activeCalls: 0,
    systemHealth: 'healthy',
    averageResponseTime: 0,
    newUsersToday: 0,
    callsToday: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load dashboard metrics and recent activity
      const [analyticsResponse, healthResponse, callsResponse] = await Promise.all([
        apiService.request('/admin/analytics?period=7d'),
        apiService.request('/admin/system/health'),
        apiService.request('/admin/calls?limit=10'),
      ]);

      const analytics = analyticsResponse.data;
      const health = healthResponse.data;
      const calls = callsResponse.data;

      // Transform analytics data to metrics
      setMetrics({
        totalUsers: analytics.users?.total || 0,
        activeUsers: analytics.users?.active || 0,
        totalCalls: analytics.calls?.total || 0,
        activeCalls: health.websocket?.activeConnections || 0,
        systemHealth: health.overall || 'healthy',
        averageResponseTime: health.system?.responseTime || 0,
        newUsersToday: analytics.users?.newThisPeriod || 0,
        callsToday: analytics.calls?.dailyBreakdown?.[0]?.calls || 0,
      });

      // Create recent activity from recent calls
      const activity: RecentActivity[] = calls.calls.slice(0, 5).map((call: any) => ({
        id: call.id,
        type: 'call_completed',
        message: `Call between ${call.blindUserName} and ${call.volunteerName}`,
        timestamp: call.endedAt,
        severity: 'success' as const,
      }));

      setRecentActivity(activity);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert(
        'Error',
        'Failed to load dashboard data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return '#10b981';
      case 'degraded': return '#f59e0b';
      case 'down': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success': return '#10b981';
      case 'info': return '#3b82f6';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getSeverityIcon = (type: string) => {
    switch (type) {
      case 'user_signup': return '👤';
      case 'call_completed': return '📞';
      case 'user_banned': return '🚫';
      case 'system_alert': return '⚠️';
      default: return '📄';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#1a237e" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Welcome back, {user?.name || 'Administrator'}
          </Text>
        </View>
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
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('UserManagement')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Manage users"
              accessibilityHint="View and manage all platform users"
            >
              <Text style={styles.quickActionIcon}>👥</Text>
              <Text style={styles.quickActionText}>User Management</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('Analytics')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="View analytics"
              accessibilityHint="View platform analytics and reports"
            >
              <Text style={styles.quickActionIcon}>📊</Text>
              <Text style={styles.quickActionText}>Analytics</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('CallHistory')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Call history"
              accessibilityHint="View call history and details"
            >
              <Text style={styles.quickActionIcon}>📞</Text>
              <Text style={styles.quickActionText}>Call History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('SystemStatus')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="System status"
              accessibilityHint="Monitor system health and performance"
            >
              <Text style={styles.quickActionIcon}>⚡</Text>
              <Text style={styles.quickActionText}>System Status</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Overview</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{metrics.totalUsers.toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Total Users</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{metrics.activeUsers.toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Active Users</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{metrics.totalCalls.toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Total Calls</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{metrics.activeCalls}</Text>
              <Text style={styles.metricLabel}>Active Calls</Text>
            </View>
          </View>
        </View>

        {/* System Health */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Health</Text>
          <View style={styles.healthCard}>
            <View style={styles.healthItem}>
              <Text style={styles.healthLabel}>Overall Status</Text>
              <Text style={[styles.healthValue, { color: getHealthColor(metrics.systemHealth) }]}>
                {metrics.systemHealth.toUpperCase()}
              </Text>
            </View>
            <View style={styles.healthItem}>
              <Text style={styles.healthLabel}>Avg Response Time</Text>
              <Text style={styles.healthValue}>
                {metrics.averageResponseTime}ms
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentActivity.length > 0 ? (
            recentActivity.map((activity) => (
              <View key={activity.id} style={styles.activityItem}>
                <View style={styles.activityIconContainer}>
                  <Text style={styles.activityIcon}>
                    {getSeverityIcon(activity.type)}
                  </Text>
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityMessage}>{activity.message}</Text>
                  <Text style={styles.activityTime}>
                    {new Date(activity.timestamp).toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.activityIndicator, { backgroundColor: getSeverityColor(activity.severity) }]} />
              </View>
            ))
          ) : (
            <Text style={styles.emptyState}>No recent activity</Text>
          )}
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
  },
  headerContent: {
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
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
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    textAlign: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00d4ff',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  healthCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  healthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  healthLabel: {
    fontSize: 16,
    color: '#333333',
  },
  healthValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  activityItem: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityIcon: {
    fontSize: 20,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#999999',
  },
  activityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyState: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    fontStyle: 'italic',
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
});

export default AdminDashboard;