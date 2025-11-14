import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  StatusBar,
  RefreshControl,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { apiService } from '../../services/api';

interface Call {
  id: string;
  blindUserId: string;
  volunteerUserId: string;
  blindUserName: string;
  volunteerName: string;
  status: 'active' | 'completed' | 'ended' | 'failed';
  startedAt: string;
  endedAt?: string;
  duration?: number; // in minutes
  rating?: number;
  feedback?: string;
  endReason?: string;
  quality?: {
    videoQuality: number;
    audioQuality: number;
    connectionStability: number;
  };
}

interface CallFilters {
  status: string;
  dateFrom: string;
  dateTo: string;
  userId: string;
}

const CallHistory = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<CallFilters>({
    status: 'all',
    dateFrom: '',
    dateTo: '',
    userId: '',
  });
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  useEffect(() => {
    loadCalls();
  }, [page, filters]);

  const loadCalls = async () => {
    try {
      setLoading(true);

      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        ),
      });

      const response = await apiService.request(`/admin/calls?${query}`);
      const callsData = response.data?.calls || [];
      const pagination = response.data?.pagination;

      setCalls(callsData);
      if (pagination) {
        setTotalPages(pagination.pages);
      }

    } catch (error) {
      console.error('Error loading call history:', error);
      Alert.alert('Error', 'Failed to load call history. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCalls();
  };

  const applyFilters = () => {
    setPage(1);
    setFilterModalVisible(false);
    loadCalls();
  };

  const clearFilters = () => {
    setFilters({
      status: 'all',
      dateFrom: '',
      dateTo: '',
      userId: '',
    });
    setPage(1);
    setFilterModalVisible(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'completed': return '#059669';
      case 'ended': return '#6b7280';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '📞';
      case 'completed': return '✅';
      case 'ended': return '📞';
      case 'failed': return '❌';
      default: return '📞';
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A';
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const renderStars = (rating?: number) => {
    if (!rating) return null;
    return (
      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Text
            key={star}
            style={[
              styles.star,
              star <= rating && styles.starFilled,
            ]}
          >
            {star <= rating ? '⭐' : '☆'}
          </Text>
        ))}
      </View>
    );
  };

  const renderCallItem = ({ item }: { item: Call }) => (
    <TouchableOpacity
      style={styles.callCard}
      onPress={() => setSelectedCall(item)}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`View details for call ${item.id}`}
    >
      <View style={styles.callHeader}>
        <View style={styles.callInfo}>
          <Text style={styles.callTitle}>
            {item.blindUserName} ↔ {item.volunteerName}
          </Text>
          <View style={styles.callMeta}>
            <View style={styles.statusContainer}>
              <Text style={styles.statusIcon}>
                {getStatusIcon(item.status)}
              </Text>
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.callDuration}>
              Duration: {formatDuration(item.duration)}
            </Text>
          </View>
        </View>
        <View style={styles.callActions}>
          {item.quality && (
            <View style={styles.qualityIndicator}>
              <Text style={styles.qualityText}>
                {Math.round((item.quality.videoQuality + item.quality.audioQuality) / 2)}%
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.callDetails}>
        <Text style={styles.callDate}>
          Started: {new Date(item.startedAt).toLocaleString()}
        </Text>
        {item.endedAt && (
          <Text style={styles.callDate}>
            Ended: {new Date(item.endedAt).toLocaleString()}
          </Text>
        )}
        {renderStars(item.rating)}
      </View>
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>Call History</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterModalVisible(true)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Filter calls"
        >
          <Text style={styles.filterButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Summary */}
      {(filters.status !== 'all' || filters.dateFrom || filters.userId) && (
        <View style={styles.filterSummary}>
          <Text style={styles.filterSummaryText}>
            Active filters: {Object.entries(filters)
              .filter(([_, value]) => value !== '')
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ')}
          </Text>
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={clearFilters}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Clear all filters"
          >
            <Text style={styles.clearFiltersText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Call List */}
      <FlatList
        data={calls}
        renderItem={renderCallItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#00d4ff']}
          />
        }
        onEndReached={() => {
          if (page < totalPages && !loading) {
            setPage(page + 1);
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading && page > 1 ? (
            <Text style={styles.loadingText}>Loading more...</Text>
          ) : null
        }
        contentContainerStyle={styles.listContainer}
      />

      {/* Call Details Modal */}
      <Modal
        visible={!!selectedCall}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        {selectedCall && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedCall(null)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Call Details</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Participants</Text>
                <Text style={styles.detailItem}>
                  Blind User: {selectedCall.blindUserName}
                </Text>
                <Text style={styles.detailItem}>
                  Volunteer: {selectedCall.volunteerName}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Timing</Text>
                <Text style={styles.detailItem}>
                  Started: {new Date(selectedCall.startedAt).toLocaleString()}
                </Text>
                {selectedCall.endedAt && (
                  <Text style={styles.detailItem}>
                    Ended: {new Date(selectedCall.endedAt).toLocaleString()}
                  </Text>
                )}
                <Text style={styles.detailItem}>
                  Duration: {formatDuration(selectedCall.duration)}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Status & Rating</Text>
                <Text style={[styles.detailItem, { color: getStatusColor(selectedCall.status) }]}>
                  Status: {selectedCall.status.toUpperCase()}
                </Text>
                {selectedCall.rating && (
                  <View style={styles.modalRating}>
                    <Text style={styles.detailItem}>User Rating:</Text>
                    {renderStars(selectedCall.rating)}
                  </View>
                )}
                {selectedCall.feedback && (
                  <Text style={styles.detailItem}>
                    Feedback: {selectedCall.feedback}
                  </Text>
                )}
                {selectedCall.endReason && (
                  <Text style={styles.detailItem}>
                    End Reason: {selectedCall.endReason}
                  </Text>
                )}
              </View>

              {selectedCall.quality && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Call Quality</Text>
                  <Text style={styles.detailItem}>
                    Video Quality: {selectedCall.quality.videoQuality}/100
                  </Text>
                  <Text style={styles.detailItem}>
                    Audio Quality: {selectedCall.quality.audioQuality}/100
                  </Text>
                  <Text style={styles.detailItem}>
                    Connection: {selectedCall.quality.connectionStability}/100
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setFilterModalVisible(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Close filters"
            >
              <Text style={styles.modalCloseText}>×</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filter Calls</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Status</Text>
              {['all', 'active', 'completed', 'ended', 'failed'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterOption,
                    filters.status === status && styles.filterOptionSelected,
                  ]}
                  onPress={() => setFilters({ ...filters, status })}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${status}`}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filters.status === status && styles.filterOptionTextSelected,
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>User ID</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter user ID..."
                value={filters.userId}
                onChangeText={(text) => setFilters({ ...filters, userId: text })}
                accessible={true}
                accessibilityLabel="User ID filter"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setFilterModalVisible(false)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.applyButton]}
                onPress={applyFilters}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Apply filters"
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 20,
  },
  filterSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    marginHorizontal: 24,
    borderRadius: 8,
  },
  filterSummaryText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
  },
  clearFiltersButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 4,
  },
  clearFiltersText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  callCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  callHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  callInfo: {
    flex: 1,
  },
  callTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  callMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  callDuration: {
    fontSize: 12,
    color: '#666666',
  },
  callActions: {
    alignItems: 'flex-end',
  },
  qualityIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#10b981',
    borderRadius: 6,
  },
  qualityText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  callDetails: {
    gap: 4,
  },
  callDate: {
    fontSize: 12,
    color: '#666666',
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  star: {
    fontSize: 12,
  },
  starFilled: {
    color: '#fbbf24',
  },
  loadingText: {
    textAlign: 'center',
    padding: 16,
    color: '#666666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 20,
    color: '#666666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  placeholder: {
    width: 32,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  detailItem: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  modalRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  applyButton: {
    backgroundColor: '#00d4ff',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
  },
  applyButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  filterOption: {
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
  },
  filterOptionSelected: {
    backgroundColor: '#00d4ff',
    borderColor: '#00d4ff',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#666666',
  },
  filterOptionTextSelected: {
    color: '#ffffff',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
});

export default CallHistory;