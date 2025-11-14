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
      // In a real app, this would check for stored auth tokens
      // and validate them with backend
      console.log('Initializing authentication state...');

      // Simulate auth check
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For now, start with unauthenticated state
      setAuthState({
        user: null,
        isAuthenticated: false,
        loading: false,
        userType: null,
      });
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

  const login = async (email: string, password: string, userType: 'blind' | 'volunteer') => {
    setAuthState(prev => ({ ...prev, loading: true }));

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock user data
      const mockUser: User = {
        id: `user_${Date.now()}`,
        email,
        name: email.split('@')[0], // Extract name from email for demo
        userType,
        emailVerified: true,
        phoneVerified: userType === 'volunteer', // Volunteers need phone verification
        createdAt: new Date().toISOString(),
        profileCompleted: false,
      };

      setAuthState({
        user: mockUser,
        isAuthenticated: true,
        loading: false,
        userType,
      });

      // In a real app, store auth tokens securely
      console.log('User logged in:', mockUser);

    } catch (error) {
      setAuthState(prev => ({ ...prev, loading: false }));
      throw new Error('Login failed. Please check your credentials and try again.');
    }
  };

  const signup = async (userData: any, userType: 'blind' | 'volunteer') => {
    setAuthState(prev => ({ ...prev, loading: true }));

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock user creation
      const mockUser: User = {
        id: `user_${Date.now()}`,
        email: userData.email,
        name: userData.name,
        userType,
        emailVerified: false, // Need to verify email
        phoneVerified: false,
        createdAt: new Date().toISOString(),
        profileCompleted: false,
      };

      // In a real app, this would create user in database
      console.log('User created:', mockUser);

      setAuthState(prev => ({ ...prev, loading: false }));

    } catch (error) {
      setAuthState(prev => ({ ...prev, loading: false }));
      throw new Error('Account creation failed. Please try again.');
    }
  };

  const logout = () => {
    setAuthState({
      user: null,
      isAuthenticated: false,
      loading: false,
      userType: null,
    });

    // In a real app, clear stored auth tokens
    console.log('User logged out');
  };

  const updateUser = (updates: Partial<User>) => {
    setAuthState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...updates } : null,
    }));
  };

  const connectWallet = (walletAddress: string) => {
    updateUser({ walletAddress });
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