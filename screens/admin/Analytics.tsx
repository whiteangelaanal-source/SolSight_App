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
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { apiService } from '../../services/api';

const { width } = Dimensions.get('window');

interface AnalyticsData {
  period: string;
  users: {
    total: number;
    active: number;
    newThisPeriod: number;
    byType: {
      blind: number;
      volunteer: number;
      admin: number;
    };
    retentionRate: number;
  };
  calls: {
    total: number;
    completed: number;
    averageDuration: number;
    successRate: number;
    dailyBreakdown: Array<{
      date: string;
      calls: number;
    }>;
  };
  rewards: {
    totalDistributed: number;
    transactions: number;
    averageReward: number;
    byType: {
      milestone: number;
      airdrop: number;
      bonus: number;
    };
  };
  geographic: Array<{
    country: string;
    users: number;
    percentage: number;
  }>;
  devices: Array<{
    platform: string;
    users: number;
    percentage: number;
  }>;
}

const Analytics = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChart, setSelectedChart] = useState<'users' | 'calls' | 'rewards'>('calls');

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const response = await apiService.request(
        `/admin/analytics?period=${selectedPeriod}`
      );
      setAnalyticsData(response.data);

    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert(
        'Error',
        'Failed to load analytics data. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const handlePeriodChange = () => {
    const periods = ['7d', '30d', '90d', '1y'];
    const currentIndex = periods.indexOf(selectedPeriod);
    const nextPeriod = periods[(currentIndex + 1) % periods.length];
    setSelectedPeriod(nextPeriod);
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      case '90d': return 'Last 90 Days';
      case '1y': return 'Last Year';
      default: return period;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const renderMetricCard = (
    title: string,
    value: string | number,
    subtitle?: string,
    color: string = '#00d4ff'
  ) => (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </View>
  );

  const renderBarChart = (data: any[], height: number = 200) => {
    const maxValue = Math.max(...data.map(item => item.value));
    const barWidth = (width - 64) / data.length - 8;

    return (
      <View style={[styles.chartContainer, { height }]}>
        {data.map((item, index) => (
          <View key={index} style={styles.chartBar}>
            <View
              style={[
                styles.chartBarFill,
                {
                  height: (item.value / maxValue) * (height - 40),
                  backgroundColor: item.color || '#00d4ff',
                },
              ]}
            />
            <Text style={styles.chartLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderPieChart = (data: any[]) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let accumulatedAngle = 0;

    return (
      <View style={styles.pieChartContainer}>
        <View style={styles.pieChart}>
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (percentage / 100) * 360;
            const startAngle = accumulatedAngle;
            const endAngle = accumulatedAngle + angle;
            accumulatedAngle += angle;

            return (
              <View key={index} style={[styles.pieSlice, { backgroundColor: item.color }]}>
                <Text style={styles.pieLabel}>{percentage.toFixed(1)}%</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.pieLegend}>
          {data.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>
                {item.label}: {item.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  if (!analyticsData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load analytics data</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadAnalytics}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Retry loading analytics"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Platform Analytics</Text>
        <TouchableOpacity
          style={styles.periodButton}
          onPress={handlePeriodChange}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Change time period"
        >
          <Text style={styles.periodButtonText}>
            {getPeriodLabel(selectedPeriod)}
          </Text>
        </TouchableOpacity>
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
        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.metricsGrid}>
            {renderMetricCard(
              'Total Users',
              formatNumber(analyticsData.users.total),
              `${analyticsData.users.newThisPeriod} new this period`
            )}
            {renderMetricCard(
              'Active Users',
              formatNumber(analyticsData.users.active),
              `${analyticsData.users.retentionRate}% retention`
            )}
            {renderMetricCard(
              'Total Calls',
              formatNumber(analyticsData.calls.total),
              `${analyticsData.calls.successRate}% success rate`
            )}
            {renderMetricCard(
              'Rewards Distributed',
              `${analyticsData.rewards.totalDistributed} SOL`,
              `${analyticsData.rewards.transactions} transactions`
            )}
          </View>
        </View>

        {/* Chart Selection */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>Analytics Charts</Text>
          <View style={styles.chartTabs}>
            {(['users', 'calls', 'rewards'] as const).map((chart) => (
              <TouchableOpacity
                key={chart}
                style={[
                  styles.chartTab,
                  selectedChart === chart && styles.chartTabActive,
                ]}
                onPress={() => setSelectedChart(chart)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`View ${chart} chart`}
              >
                <Text
                  style={[
                    styles.chartTabText,
                    selectedChart === chart && styles.chartTabTextActive,
                  ]}
                >
                  {chart.charAt(0).toUpperCase() + chart.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* User Charts */}
          {selectedChart === 'users' && (
            <View>
              <View style={styles.section}>
                <Text style={styles.subsectionTitle}>Users by Type</Text>
                {renderPieChart([
                  {
                    label: 'Blind Users',
                    value: analyticsData.users.byType.blind,
                    color: '#0ea5e9',
                  },
                  {
                    label: 'Volunteers',
                    value: analyticsData.users.byType.volunteer,
                    color: '#059669',
                  },
                  {
                    label: 'Admins',
                    value: analyticsData.users.byType.admin,
                    color: '#7c3aed',
                  },
                ])}
              </View>

              <View style={styles.section}>
                <Text style={styles.subsectionTitle}>Geographic Distribution</Text>
                {renderBarChart(
                  analyticsData.geographic.map((item) => ({
                    label: item.country,
                    value: item.users,
                    color: '#00d4ff',
                  }))
                )}
              </View>
            </View>
          )}

          {/* Calls Charts */}
          {selectedChart === 'calls' && (
            <View>
              <View style={styles.section}>
                <Text style={styles.subsectionTitle}>Daily Call Volume</Text>
                {renderBarChart(
                  analyticsData.calls.dailyBreakdown.slice(-7).map((item) => ({
                    label: new Date(item.date).toLocaleDateString('en', { weekday: 'short' }),
                    value: item.calls,
                    color: '#10b981',
                  }))
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.subsectionTitle}>Call Performance</Text>
                <View style={styles.performanceMetrics}>
                  <Text style={styles.performanceLabel}>
                    Average Duration: {analyticsData.calls.averageDuration} min
                  </Text>
                  <Text style={styles.performanceLabel}>
                    Success Rate: {analyticsData.calls.successRate}%
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Rewards Charts */}
          {selectedChart === 'rewards' && (
            <View>
              <View style={styles.section}>
                <Text style={styles.subsectionTitle}>Rewards by Type</Text>
                {renderPieChart([
                  {
                    label: 'Milestone',
                    value: analyticsData.rewards.byType.milestone,
                    color: '#f59e0b',
                  },
                  {
                    label: 'Airdrop',
                    value: analyticsData.rewards.byType.airdrop,
                    color: '#8b5cf6',
                  },
                  {
                    label: 'Bonus',
                    value: analyticsData.rewards.byType.bonus,
                    color: '#10b981',
                  },
                ])}
              </View>

              <View style={styles.section}>
                <Text style={styles.subsectionTitle}>Reward Statistics</Text>
                <View style={styles.performanceMetrics}>
                  <Text style={styles.performanceLabel}>
                    Total Distributed: {analyticsData.rewards.totalDistributed} SOL
                  </Text>
                  <Text style={styles.performanceLabel}>
                    Average Reward: {analyticsData.rewards.averageReward} SOL
                  </Text>
                  <Text style={styles.performanceLabel}>
                    Total Transactions: {analyticsData.rewards.transactions}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Device Usage */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Usage</Text>
          {renderPieChart(
            analyticsData.devices.map((item) => ({
              label: item.platform,
              value: item.users,
              color: item.platform === 'Android' ? '#059669' : '#0ea5e9',
            }))
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
    flex: 1,
    textAlign: 'center',
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
  },
  periodButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
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
  subsectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 12,
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricTitle: {
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
    fontWeight: '600',
  },
  metricSubtitle: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  chartSection: {
    marginBottom: 32,
  },
  chartTabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  chartTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  chartTabActive: {
    backgroundColor: '#00d4ff',
  },
  chartTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  chartTabTextActive: {
    color: '#ffffff',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 4,
    minHeight: 2,
  },
  chartLabel: {
    fontSize: 10,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  pieChartContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  pieChart: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  pieSlice: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pieLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  pieLegend: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#333333',
  },
  performanceMetrics: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
  },
  performanceLabel: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 8,
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
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#00d4ff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default Analytics;