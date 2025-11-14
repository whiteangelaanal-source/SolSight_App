import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AccessibilityInfo } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const UserTypeScreen = () => {
  const navigation = useNavigation();

  const handleUserTypeSelect = (userType) => {
    // Announce selection for accessibility
    AccessibilityInfo.announceForAccessibility(`Selected: ${userType}`);

    // Navigate to appropriate screen based on user type
    if (userType === 'blind') {
      navigation.navigate('Login', { userType: 'blind' });
    } else {
      navigation.navigate('Login', { userType: 'volunteer' });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} accessible accessibilityLabel="SolSight App">
          SolSight
        </Text>
        <Text style={styles.subtitle} accessible accessibilityLabel="Choose how you want to use the app">
          Connecting people through technology
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.blindUserButton]}
            onPress={() => handleUserTypeSelect('blind')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="I need help - For blind and low vision users"
            accessibilityHint="Select this if you need assistance from volunteers"
          >
            <Text style={styles.buttonText}>I need help</Text>
            <Text style={styles.buttonSubtext}>Blind / Low-Vision User</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.volunteerButton]}
            onPress={() => handleUserTypeSelect('volunteer')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="I want to help - For volunteers who want to assist others"
            accessibilityHint="Select this if you want to volunteer to help others"
          >
            <Text style={styles.buttonText}>I want to help</Text>
            <Text style={styles.buttonSubtext}>Volunteer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e', // Dark background for high contrast
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
    // Solana gradient effect simulated with text shadow
    textShadowColor: '#00d4ff',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#b0b0b0',
    marginBottom: 60,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 24,
  },
  button: {
    width: '100%',
    minHeight: 120, // Large touch target (minimum 44x44 points)
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    // Add subtle animation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  blindUserButton: {
    // Solana green gradient
    backgroundColor: '#00d4ff',
    borderWidth: 2,
    borderColor: '#00a8cc',
  },
  volunteerButton: {
    // Solana purple gradient
    backgroundColor: '#9945ff',
    borderWidth: 2,
    borderColor: '#7c3aed',
  },
  buttonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  buttonSubtext: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default UserTypeScreen;