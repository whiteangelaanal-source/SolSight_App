import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { apiService } from '../services/api';

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: 'blind' | 'volunteer';
  walletAddress?: string;
  phone?: string;
  isVerified?: boolean;
  reputationScore?: number;
  totalCalls?: number;
  totalHelpMinutes?: number;
  averageRating?: number;
  isAvailable?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  userType: 'blind' | 'volunteer' | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  connectWallet: (walletAddress: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    loading: true,
    userType: null,
  });

  // Initialize auth state on app start
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Check for stored user data
      const user = await apiService.getCurrentUser();

      if (user) {
        setAuthState({
          user,
          isAuthenticated: true,
          loading: false,
          userType: user.userType,
        });
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          loading: false,
          userType: null,
        });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        loading: false,
        userType: null,
      });
    }
  };

  const login = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true }));

    try {
      const user = await apiService.login(email, password);

      setAuthState({
        user,
        isAuthenticated: true,
        loading: false,
        userType: user.userType,
      });

      console.log('User logged in:', user);

    } catch (error) {
      setAuthState(prev => ({ ...prev, loading: false }));
      throw error;
    }
  };

  const signup = async (userData: any) => {
    setAuthState(prev => ({ ...prev, loading: true }));

    try {
      const user = await apiService.register(userData);

      setAuthState({
        user,
        isAuthenticated: true,
        loading: false,
        userType: user.userType,
      });

      console.log('User created:', user);

    } catch (error) {
      setAuthState(prev => ({ ...prev, loading: false }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API error:', error);
    }

    setAuthState({
      user: null,
      isAuthenticated: false,
      loading: false,
      userType: null,
    });

    console.log('User logged out');
  };

  const updateUser = async (updates: Partial<User>) => {
    try {
      const updatedUser = await apiService.updateProfile(updates);

      setAuthState(prev => ({
        ...prev,
        user: updatedUser,
      }));
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  };

  const connectWallet = async (walletAddress: string) => {
    try {
      await apiService.setWalletAddress(walletAddress);

      // Update local state
      if (authState.user) {
        setAuthState(prev => ({
          ...prev,
          user: { ...prev.user, walletAddress },
        }));
      }
    } catch (error) {
      console.error('Connect wallet error:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const user = await apiService.getCurrentUser();

      if (user) {
        setAuthState(prev => ({
          ...prev,
          user,
          isAuthenticated: true,
          userType: user.userType,
        }));
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      // Don't throw error, just log it
    }
  };

  const contextValue: AuthContextType = {
    ...authState,
    login,
    signup,
    logout,
    updateUser,
    connectWallet,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// HOC to protect routes
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
  requiredUserType?: 'blind' | 'volunteer'
) => {
  return (props: P) => {
    const { isAuthenticated, loading, user, userType } = useAuth();

    if (loading) {
      // Show loading screen
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00d4ff" />
        </View>
      );
    }

    if (!isAuthenticated) {
      // Redirect to login
      // In a real app, you'd use navigation to redirect
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Please log in to continue</Text>
        </View>
      );
    }

    if (requiredUserType && userType !== requiredUserType) {
      // Wrong user type
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>This page is not available for your user type</Text>
        </View>
      );
    }

    return <Component {...props} />;
  };
};

export default AuthProvider;