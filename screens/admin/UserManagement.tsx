import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  StatusBar,
  Modal,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { apiService } from '../../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  userType: 'blind' | 'volunteer' | 'admin';
  isActive: boolean;
  banned: boolean;
  createdAt: string;
  lastLogin?: string;
  totalCalls?: number;
  averageRating?: number;
  reliabilityScore?: number;
}

interface UserDetails {
  user: User;
  callHistory: any[];
  stats: any;
}

const UserManagement = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [banModalVisible, setBanModalVisible] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState<number>(7);

  useEffect(() => {
    loadUsers();
  }, [page, filterRole, filterStatus]);

  const loadUsers = async () => {
    try {
      setLoading(true);

      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        role: filterRole === 'all' ? '' : filterRole,
        status: filterStatus === 'all' ? '' : filterStatus,
        search: searchQuery || '',
      });

      const response = await apiService.request(`/admin/users?${query}`);
      const usersData = response.data?.users || [];
      const pagination = response.data?.pagination;

      setUsers(usersData);
      if (pagination) {
        setTotalPages(pagination.pages);
      }

    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUserDetails = async (userId: string) => {
    try {
      const response = await apiService.request(`/admin/users/${userId}`);
      setUserDetails(response.data);
    } catch (error) {
      console.error('Error loading user details:', error);
      Alert.alert('Error', 'Failed to load user details.');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const handleSearch = () => {
    setPage(1);
    loadUsers();
  };

  const handleBanUser = () => {
    if (!selectedUser || !banReason.trim()) {
      Alert.alert('Error', 'Please provide a ban reason.');
      return;
    }

    Alert.alert(
      'Confirm Ban',
      `Are you sure you want to ban ${selectedUser.name}? This action will prevent them from using the platform.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban User',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.request(`/admin/users/${selectedUser.id}/ban`, {
                method: 'POST',
                body: JSON.stringify({
                  reason: banReason,
                  duration: banDuration,
                  notifyUser: true,
                }),
              });

              Alert.alert('Success', 'User has been banned successfully.');
              setBanModalVisible(false);
              setBanReason('');
              setSelectedUser(null);
              loadUsers(); // Refresh the list
            } catch (error) {
              console.error('Error banning user:', error);
              Alert.alert('Error', 'Failed to ban user.');
            }
          },
        },
      ]
    );
  };

  const handleUnbanUser = async (user: User) => {
    Alert.alert(
      'Confirm Unban',
      `Are you sure you want to unban ${user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unban User',
          onPress: async () => {
            try {
              await apiService.request(`/admin/users/${user.id}/unban`, {
                method: 'POST',
              });

              Alert.alert('Success', 'User has been unbanned successfully.');
              loadUsers(); // Refresh the list
            } catch (error) {
              console.error('Error unbanning user:', error);
              Alert.alert('Error', 'Failed to unban user.');
            }
          },
        },
      ]
    );
  };

  const getUserStatusColor = (user: User) => {
    if (user.banned) return '#ef4444';
    if (!user.isActive) return '#6b7280';
    return '#10b981';
  };

  const getUserStatusText = (user: User) => {
    if (user.banned) return 'Banned';
    if (!user.isActive) return 'Inactive';
    return 'Active';
  };

  const getUserRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#7c3aed';
      case 'blind': return '#0ea5e9';
      case 'volunteer': return '#059669';
      default: return '#6b7280';
    }
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => {
        setSelectedUser(item);
        loadUserDetails(item.id);
      }}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`View details for ${item.name}`}
    >
      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <Text style={styles.userName}>{item.name}</Text>
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, { color: getUserStatusColor(item) }]}>
              {getUserStatusText(item)}
            </Text>
          </View>
        </View>
        <Text style={styles.userEmail}>{item.email}</Text>
        <View style={styles.userMeta}>
          <Text style={[styles.userType, { color: getUserRoleColor(item.userType) }]}>
            {item.userType.charAt(0).toUpperCase() + item.userType.slice(1)}
          </Text>
          <Text style={styles.userJoinDate}>
            Joined {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        {item.totalCalls !== undefined && (
          <Text style={styles.userStats}>
            {item.totalCalls} calls • Rating: {item.averageRating?.toFixed(1) || 'N/A'}
          </Text>
        )}
      </View>
      <View style={styles.userActions}>
        {item.banned ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.unbanButton]}
            onPress={() => handleUnbanUser(item)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Unban ${item.name}`}
          >
            <Text style={styles.actionButtonText}>Unban</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.banButton]}
            onPress={() => {
              setSelectedUser(item);
              setBanModalVisible(true);
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Ban ${item.name}`}
          >
            <Text style={styles.actionButtonText}>Ban</Text>
          </TouchableOpacity>
        )}
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
        <Text style={styles.headerTitle}>User Management</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search and Filters */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessible={true}
            accessibilityLabel="Search users"
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => {
              const filters = ['all', 'blind', 'volunteer', 'admin'];
              const currentIndex = filters.indexOf(filterRole);
              const nextFilter = filters[(currentIndex + 1) % filters.length];
              setFilterRole(nextFilter);
              setPage(1);
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Filter by role"
          >
            <Text style={styles.filterButtonText}>
              Role: {filterRole.charAt(0).toUpperCase() + filterRole.slice(1)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => {
              const filters = ['all', 'active', 'inactive', 'banned'];
              const currentIndex = filters.indexOf(filterStatus);
              const nextFilter = filters[(currentIndex + 1) % filters.length];
              setFilterStatus(nextFilter);
              setPage(1);
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Filter by status"
          >
            <Text style={styles.filterButtonText}>
              Status: {filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* User List */}
      <FlatList
        data={users}
        renderItem={renderUserItem}
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

      {/* User Details Modal */}
      <Modal
        visible={!!selectedUser}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        {selectedUser && userDetails && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setSelectedUser(null);
                  setUserDetails(null);
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.modalCloseText}>×</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>User Details</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Basic Information</Text>
                <Text style={styles.detailItem}>Name: {selectedUser.name}</Text>
                <Text style={styles.detailItem}>Email: {selectedUser.email}</Text>
                <Text style={styles.detailItem}>Type: {selectedUser.userType}</Text>
                <Text style={styles.detailItem}>Status: {getUserStatusText(selectedUser)}</Text>
                <Text style={styles.detailItem}>
                  Joined: {new Date(selectedUser.createdAt).toLocaleString()}
                </Text>
              </View>

              {userDetails.stats && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Statistics</Text>
                  <Text style={styles.detailItem}>
                    Total Calls: {userDetails.stats.totalCalls || 0}
                  </Text>
                  <Text style={styles.detailItem}>
                    Average Rating: {userDetails.stats.averageRating || 'N/A'}
                  </Text>
                  <Text style={styles.detailItem}>
                    Reliability Score: {userDetails.stats.reliabilityScore || 'N/A'}%
                  </Text>
                  <Text style={styles.detailItem}>
                    Total Rewards: {userDetails.stats.totalRewards || 0} SOL
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Ban Modal */}
      <Modal
        visible={banModalVisible}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.banModalOverlay}>
          <View style={styles.banModal}>
            <Text style={styles.banModalTitle}>Ban User</Text>
            <Text style={styles.banModalSubtitle}>
              Banning {selectedUser?.name}
            </Text>

            <TextInput
              style={styles.banReasonInput}
              placeholder="Enter ban reason..."
              value={banReason}
              onChangeText={setBanReason}
              multiline={true}
              numberOfLines={3}
              accessible={true}
              accessibilityLabel="Ban reason"
            />

            <View style={styles.durationRow}>
              <Text style={styles.durationLabel}>Ban Duration:</Text>
              <TouchableOpacity
                style={styles.durationButton}
                onPress={() => {
                  const durations = [1, 7, 30, 0]; // 0 = permanent
                  const currentIndex = durations.indexOf(banDuration);
                  const nextDuration = durations[(currentIndex + 1) % durations.length];
                  setBanDuration(nextDuration);
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Change ban duration"
              >
                <Text style={styles.durationButtonText}>
                  {banDuration === 0 ? 'Permanent' : `${banDuration} days`}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.banModalActions}>
              <TouchableOpacity
                style={[styles.banModalButton, styles.cancelButton]}
                onPress={() => {
                  setBanModalVisible(false);
                  setBanReason('');
                  setSelectedUser(null);
                }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Cancel ban"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.banModalButton, styles.confirmBanButton]}
                onPress={handleBanUser}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Confirm ban"
              >
                <Text style={styles.confirmBanButtonText}>Ban User</Text>
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
  },
  placeholder: {
    width: 40,
  },
  searchSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginRight: 12,
    fontSize: 16,
  },
  searchButton: {
    height: 44,
    paddingHorizontal: 20,
    backgroundColor: '#00d4ff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterButton: {
    height: 36,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  userCard: {
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
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userType: {
    fontSize: 12,
    fontWeight: '600',
    padding: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  userJoinDate: {
    fontSize: 12,
    color: '#999',
  },
  userStats: {
    fontSize: 12,
    color: '#666',
  },
  statusContainer: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  userActions: {
    marginLeft: 16,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  banButton: {
    backgroundColor: '#ef4444',
  },
  unbanButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  loadingText: {
    textAlign: 'center',
    padding: 16,
    color: '#666',
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
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
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
    color: '#666',
    marginBottom: 8,
  },
  banModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  banModal: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  banModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
    textAlign: 'center',
  },
  banModalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  banReasonInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlignVertical: 'top',
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  durationLabel: {
    fontSize: 16,
    color: '#333',
  },
  durationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  durationButtonText: {
    fontSize: 14,
    color: '#666',
  },
  banModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  banModalButton: {
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
  confirmBanButton: {
    backgroundColor: '#ef4444',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  confirmBanButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default UserManagement;