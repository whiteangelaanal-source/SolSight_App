import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import UserTypeScreen from './screens/UserTypeScreen';
import LoginScreen from './screens/auth/LoginScreen';
import SignupScreen from './screens/auth/SignupScreen';
import BlindDashboard from './screens/BlindDashboard';
import VolunteerDashboard from './screens/VolunteerDashboard';
import VideoCallScreen from './screens/VideoCallScreen';
import RewardsScreen from './screens/RewardsScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      gestureEnabled: false,
    }}
  >
    <Stack.Screen name="UserType" component={UserTypeScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
  </Stack.Navigator>
);

const VolunteerTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: true,
      tabBarStyle: {
        backgroundColor: '#1a1a2e',
        borderTopColor: '#333',
      },
      tabBarActiveTintColor: '#00d4ff',
      tabBarInactiveTintColor: '#666',
    }}
  >
    <Tab.Screen
      name="Dashboard"
      component={VolunteerDashboard}
      options={{ title: 'Home' }}
    />
    <Tab.Screen
      name="Rewards"
      component={RewardsScreen}
      options={{ title: 'Rewards' }}
    />
    <Tab.Screen
      name="Leaderboard"
      component={LeaderboardScreen}
      options={{ title: 'Leaderboard' }}
    />
  </Tab.Navigator>
);

const App = () => {
  // In a real app, you'd use authentication state to determine which stack to show
  const isAuthenticated = false; // This will be managed by auth context
  const userType = null; // This will be managed by auth context

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <AuthStack />
      ) : userType === 'blind' ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="BlindDashboard" component={BlindDashboard} />
          <Stack.Screen name="VideoCall" component={VideoCallScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="VolunteerTabs" component={VolunteerTabs} />
          <Stack.Screen name="VideoCall" component={VideoCallScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

export default App;
