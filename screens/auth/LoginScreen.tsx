import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

const LoginScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { userType } = route.params || { userType: 'blind' };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isBlindUser = userType === 'blind';

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // In a real app, this would authenticate with Firebase Auth
      console.log('Login attempt:', { email, userType });

      // Announce successful login for accessibility
      AccessibilityInfo.announceForAccessibility('Login successful');

      // Navigate to appropriate dashboard
      if (isBlindUser) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'BlindDashboard' }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'VolunteerTabs' }],
        });
      }
    } catch (error) {
      Alert.alert('Login Failed', error.message);
      AccessibilityInfo.announceForAccessibility('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = () => {
    navigation.navigate('Signup', { userType });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isBlindUser ? '#0f1419' : '#1a1a2e', // Higher contrast for blind users
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: isBlindUser ? 32 : 24, // Wider padding for blind users
      paddingVertical: 40,
    },
    title: {
      fontSize: isBlindUser ? 36 : 32, // Larger text for blind users
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 16,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: isBlindUser ? 20 : 18,
      color: '#b0b0b0',
      marginBottom: isBlindUser ? 60 : 48,
      textAlign: 'center',
      lineHeight: isBlindUser ? 28 : 24,
    },
    input: {
      height: isBlindUser ? 64 : 56, // Larger touch targets for blind users
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 12,
      paddingHorizontal: 20,
      fontSize: isBlindUser ? 18 : 16,
      color: '#ffffff',
      marginBottom: isBlindUser ? 24 : 16,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    button: {
      height: isBlindUser ? 72 : 60, // Larger buttons for blind users
      backgroundColor: '#00d4ff',
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: isBlindUser ? 24 : 16,
      shadowColor: '#00d4ff',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    buttonText: {
      fontSize: isBlindUser ? 20 : 18,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    signupButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: '#00d4ff',
      shadowOpacity: 0,
      elevation: 0,
    },
    signupButtonText: {
      color: '#00d4ff',
    },
    voiceInputButton: {
      height: 48,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    voiceInputText: {
      fontSize: 16,
      color: '#b0b0b0',
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text
            style={styles.title}
            accessible
            accessibilityLabel={`${isBlindUser ? 'Blind User' : 'Volunteer'} Login`}
          >
            {isBlindUser ? 'Welcome Back' : 'Volunteer Login'}
          </Text>

          <Text
            style={styles.subtitle}
            accessible
            accessibilityLabel="Sign in to your account"
          >
            {isBlindUser
              ? 'Get connected with volunteers who can help you'
              : 'Sign in to start helping others'
            }
          </Text>

          {/* Voice input option for blind users */}
          {isBlindUser && (
            <TouchableOpacity
              style={styles.voiceInputButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Use voice to input email"
              accessibilityHint="Tap to speak your email address"
            >
              <Text style={styles.voiceInputText}>🎤 Use Voice Input</Text>
            </TouchableOpacity>
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888888"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            accessible={true}
            accessibilityLabel="Email address"
            accessibilityHint="Enter your email address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            accessible={true}
            accessibilityLabel="Password"
            accessibilityHint="Enter your password"
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={loading}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            accessibilityHint={loading ? "Signing in..." : "Tap to sign in to your account"}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.signupButton]}
            onPress={handleSignup}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Create new account"
            accessibilityHint="Don't have an account? Sign up here"
          >
            <Text style={[styles.buttonText, styles.signupButtonText]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;