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

const SignupScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { userType } = route.params || { userType: 'blind' };

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '', // Required for volunteers
  });
  const [loading, setLoading] = useState(false);

  const isBlindUser = userType === 'blind';

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.name) {
      return 'Please fill in all required fields';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match';
    }

    if (formData.password.length < 8) {
      return 'Password must be at least 8 characters';
    }

    if (!isBlindUser && !formData.phone) {
      return 'Phone number is required for volunteers';
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }

    return null;
  };

  const handleSignup = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    setLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In a real app, this would:
      // 1. Create Firebase Auth user
      // 2. Store user data in database
      // 3. Send verification email
      // 4. For volunteers: send phone verification code
      console.log('Signup attempt:', { ...formData, userType });

      // Announce successful signup for accessibility
      AccessibilityInfo.announceForAccessibility('Account created successfully');

      // Show success message
      Alert.alert(
        'Success!',
        isBlindUser
          ? 'Your account has been created. Please check your email to verify your account.'
          : 'Your account has been created. Please check your email for verification and expect a phone verification code.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to login
              navigation.navigate('Login', { userType });
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Signup Failed', error.message);
      AccessibilityInfo.announceForAccessibility('Account creation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    navigation.navigate('Login', { userType });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isBlindUser ? '#0f1419' : '#1a1a2e',
    },
    keyboardView: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: isBlindUser ? 32 : 24,
      paddingVertical: 40,
    },
    title: {
      fontSize: isBlindUser ? 36 : 32,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 16,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: isBlindUser ? 20 : 18,
      color: '#b0b0b0',
      marginBottom: isBlindUser ? 40 : 32,
      textAlign: 'center',
      lineHeight: isBlindUser ? 28 : 24,
    },
    input: {
      height: isBlindUser ? 64 : 56,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 12,
      paddingHorizontal: 20,
      fontSize: isBlindUser ? 18 : 16,
      color: '#ffffff',
      marginBottom: isBlindUser ? 20 : 16,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    button: {
      height: isBlindUser ? 72 : 60,
      backgroundColor: '#9945ff', // Different color for signup
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: isBlindUser ? 20 : 16,
      shadowColor: '#9945ff',
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
    loginButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: '#9945ff',
      shadowOpacity: 0,
      elevation: 0,
    },
    loginButtonText: {
      color: '#9945ff',
    },
    requiredField: {
      color: '#ff6b6b',
      fontSize: 12,
      marginLeft: 4,
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
    fieldLabel: {
      fontSize: isBlindUser ? 16 : 14,
      color: '#ffffff',
      marginBottom: 8,
      fontWeight: '500',
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
            accessibilityLabel={`${isBlindUser ? 'Blind User' : 'Volunteer'} Sign Up`}
          >
            Create Account
          </Text>

          <Text
            style={styles.subtitle}
            accessible
            accessibilityLabel="Join the SolSight community"
          >
            {isBlindUser
              ? 'Join our community and get help when you need it'
              : 'Become a volunteer and make a difference in people\'s lives'
            }
          </Text>

          {/* Voice input option for blind users */}
          {isBlindUser && (
            <TouchableOpacity
              style={styles.voiceInputButton}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Use voice to input form fields"
              accessibilityHint="Tap to speak your information"
            >
              <Text style={styles.voiceInputText}>🎤 Use Voice Input</Text>
            </TouchableOpacity>
          )}

          {/* Name Field */}
          <Text style={styles.fieldLabel}>
            Full Name <Text style={styles.requiredField}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            placeholderTextColor="#888888"
            value={formData.name}
            onChangeText={(value) => handleInputChange('name', value)}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            accessible={true}
            accessibilityLabel="Full name"
            accessibilityHint="Enter your full name"
          />

          {/* Email Field */}
          <Text style={styles.fieldLabel}>
            Email Address <Text style={styles.requiredField}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#888888"
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            accessible={true}
            accessibilityLabel="Email address"
            accessibilityHint="Enter your email address"
          />

          {/* Phone Field (Volunteers only) */}
          {!isBlindUser && (
            <>
              <Text style={styles.fieldLabel}>
                Phone Number <Text style={styles.requiredField}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                placeholderTextColor="#888888"
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                accessible={true}
                accessibilityLabel="Phone number"
                accessibilityHint="Enter your phone number for verification"
              />
            </>
          )}

          {/* Password Field */}
          <Text style={styles.fieldLabel}>
            Password <Text style={styles.requiredField}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Create a password (min 8 characters)"
            placeholderTextColor="#888888"
            value={formData.password}
            onChangeText={(value) => handleInputChange('password', value)}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            accessible={true}
            accessibilityLabel="Password"
            accessibilityHint="Create a password with at least 8 characters"
          />

          {/* Confirm Password Field */}
          <Text style={styles.fieldLabel}>
            Confirm Password <Text style={styles.requiredField}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm your password"
            placeholderTextColor="#888888"
            value={formData.confirmPassword}
            onChangeText={(value) => handleInputChange('confirmPassword', value)}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            accessible={true}
            accessibilityLabel="Confirm password"
            accessibilityHint="Re-enter your password to confirm"
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleSignup}
            disabled={loading}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Create account"
            accessibilityHint={loading ? "Creating account..." : "Tap to create your account"}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.loginButton]}
            onPress={handleLogin}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Already have an account? Sign in"
            accessibilityHint="Go to login screen"
          >
            <Text style={[styles.buttonText, styles.loginButtonText]}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignupScreen;