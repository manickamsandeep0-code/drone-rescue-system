import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  AppState,
  StatusBar,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Accelerometer } from 'expo-sensors';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, serverTimestamp } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBaA-wkSsMnDz5hDpeIj9B1bFJEEiM3UOA",
  authDomain: "drone-rescue-system.firebaseapp.com",
  databaseURL: "https://drone-rescue-system-default-rtdb.firebaseio.com",
  projectId: "drone-rescue-system",
  storageBucket: "drone-rescue-system.firebasestorage.app",
  messagingSenderId: "891859396445",
  appId: "1:891859396445:web:10351b69776babb7f9eab4",
  measurementId: "G-GVMMX89N5V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Configure notifications for foreground service
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const appState = useRef(AppState.currentState);
  const [shakeDetected, setShakeDetected] = useState(false);
  const [serviceActive, setServiceActive] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const notificationId = useRef(null);

  // Shake detection variables
  const SHAKE_THRESHOLD = 1.5;
  const subscription = useRef(null);
  const lastShakeTime = useRef(0);

  useEffect(() => {
    // Request notification permissions
    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.requestPermissionsAsync();
      }
    })();

    // Request location permissions and get current location
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required for this app to function.');
          setLoading(false);
          return;
        }

        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        setLoading(false);
      } catch (error) {
        console.error('Error getting location:', error);
        Alert.alert('Error', 'Failed to get location. Please check your settings.');
        setLoading(false);
      }
    })();

    // Set up AppState listener
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
    });

    // Set up shake detection (works in background too)
    subscription.current = Accelerometer.addListener(accelerometerData => {
      const { x, y, z } = accelerometerData;
      const acceleration = Math.sqrt(x * x + y * y + z * z);
      
      // Detect shake even when app is in background
      if (acceleration > SHAKE_THRESHOLD) {
        const now = Date.now();
        // Debounce: only trigger once every 2 seconds
        if (now - lastShakeTime.current > 2000) {
          lastShakeTime.current = now;
          handleShake();
        }
      }
    });

    Accelerometer.setUpdateInterval(100);

    // Cleanup
    return () => {
      appStateSubscription?.remove();
      subscription.current?.remove();
    };
  }, []);

  const handleShake = async () => {
    if (!shakeDetected) {
      setShakeDetected(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // If app is in background, bring it to foreground
      if (appState.current !== 'active') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 SHAKE DETECTED!',
            body: 'Tap to open Drone Rescue and select emergency type',
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null, // Show immediately
        });
      } else {
        Alert.alert(
          'Shake Detected!',
          'Emergency shake gesture detected. Please select an emergency type.',
          [{ text: 'OK' }]
        );
      }
      
      // Reset shake detection after 2 seconds
      setTimeout(() => setShakeDetected(false), 2000);
    }
  };

  const startBackgroundService = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('iOS Limitation', 'Background shake detection is only available on Android due to iOS restrictions.');
      return;
    }

    try {
      // Show persistent notification
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚁 Drone Rescue Active',
          body: 'Shake detection running. Tap to open app.',
          sticky: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
      
      notificationId.current = id;
      setServiceActive(true);
      
      Alert.alert(
        'Background Service Started',
        'Shake detection is now active even when the app is in background. Keep the app running (minimized) for best results.',
        [{ text: 'Got it!' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to start background service: ' + error.message);
    }
  };

  const stopBackgroundService = async () => {
    if (notificationId.current) {
      await Notifications.dismissNotificationAsync(notificationId.current);
      notificationId.current = null;
    }
    setServiceActive(false);
    Alert.alert('Background Service Stopped', 'Shake detection will only work when app is open.');
  };

  const createHomeScreenShortcut = () => {
    Alert.alert(
      'Emergency Access Tip',
      Platform.OS === 'android'
        ? 'For fastest access:\n\n1. Long-press the app icon\n2. Drag "Emergency" widget to home screen\n3. Tap widget for instant access\n\nAlternatively:\n- Keep app running in background\n- Use app switcher (Recent Apps) for quick access'
        : 'For fastest access:\n\n1. Add app to home screen\n2. Enable app in Control Center\n3. Use app switcher for quick access',
      [{ text: 'Got it' }]
    );
  };

  const sendEmergencyData = async (type) => {
    if (!location) {
      Alert.alert('Error', 'Location not available. Please wait and try again.');
      return;
    }

    setSending(true);

    try {
      // Haptic feedback on button press
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const emergencyData = {
        type: type,
        lat: location.latitude,
        long: location.longitude,
        timestamp: serverTimestamp(),
      };

      // Update Firebase at /drone_status
      const droneStatusRef = ref(database, 'drone_status');
      await set(droneStatusRef, emergencyData);

      // Success haptic
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setSending(false);

      Alert.alert(
        'Emergency Dispatched!',
        `${type.toUpperCase()} emergency has been sent to the drone nerve center.\n\nLocation: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      setSending(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to send emergency data: ${error.message}`);
      console.error('Firebase error:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#00D9FF" />
        <Text style={styles.loadingText}>Initializing Drone System...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>🚁 DRONE RESCUE</Text>
          <TouchableOpacity 
            style={styles.settingsIcon}
            onPress={() => setSettingsVisible(true)}
          >
            <Text style={styles.settingsIconText}>⚙️</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Autonomous Emergency Response System</Text>
        {location && (
          <View style={styles.locationBadge}>
            <Text style={styles.locationText}>
              📍 {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
            </Text>
          </View>
        )}
        {serviceActive && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>🟢 Background Active</Text>
          </View>
        )}
      </View>

      {/* Emergency Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.medicalButton]}
          onPress={() => sendEmergencyData('medical')}
          disabled={sending}
        >
          <Text style={styles.buttonIcon}>🏥</Text>
          <Text style={styles.buttonText}>MEDICAL</Text>
          <Text style={styles.buttonText}>EMERGENCY</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.fireButton]}
          onPress={() => sendEmergencyData('fire')}
          disabled={sending}
        >
          <Text style={styles.buttonIcon}>🔥</Text>
          <Text style={styles.buttonText}>FIRE</Text>
          <Text style={styles.buttonText}>DISASTER</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.patrolButton]}
          onPress={() => sendEmergencyData('patrol')}
          disabled={sending}
        >
          <Text style={styles.buttonIcon}>🚓</Text>
          <Text style={styles.buttonText}>PATROL</Text>
          <Text style={styles.buttonText}>REQUEST</Text>
        </TouchableOpacity>
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 Shake phone to trigger emergency alert
        </Text>
        {sending && (
          <View style={styles.sendingIndicator}>
            <ActivityIndicator size="small" color="#00D9FF" />
            <Text style={styles.sendingText}>Dispatching drone...</Text>
          </View>
        )}
      </View>

      {/* Settings Modal */}
      <Modal
        visible={settingsVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚙️ Settings</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Background Service Section */}
              <View style={styles.settingSection}>
                <Text style={styles.sectionTitle}>Background Detection</Text>
                <Text style={styles.sectionDescription}>
                  {Platform.OS === 'android'
                    ? 'Enable shake detection when app is minimized. Keep app running in background.'
                    : 'Background detection not available on iOS due to system restrictions.'}
                </Text>
                
                {Platform.OS === 'android' && (
                  <TouchableOpacity
                    style={[styles.settingToggle, serviceActive && styles.settingToggleActive]}
                    onPress={serviceActive ? stopBackgroundService : startBackgroundService}
                  >
                    <Text style={styles.settingToggleIcon}>{serviceActive ? '🟢' : '⚪'}</Text>
                    <Text style={styles.settingToggleText}>
                      {serviceActive ? 'Background Service ON' : 'Enable Background Service'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Emergency Access Tips */}
              <View style={styles.settingSection}>
                <Text style={styles.sectionTitle}>Quick Access Tips</Text>
                <Text style={styles.sectionDescription}>
                  Since apps cannot auto-launch from closed state, here are the fastest ways to access in emergencies:
                </Text>
                
                <View style={styles.tipsList}>
                  <Text style={styles.tipItem}>• Keep app running in background (minimized)</Text>
                  <Text style={styles.tipItem}>• Use Recent Apps / App Switcher for instant access</Text>
                  <Text style={styles.tipItem}>• Add app widget to home screen (Android)</Text>
                  <Text style={styles.tipItem}>• Place app icon in easily reachable location</Text>
                  {Platform.OS === 'android' && (
                    <Text style={styles.tipItem}>• Enable "Lock screen shortcuts" in phone settings</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.infoButton}
                  onPress={createHomeScreenShortcut}
                >
                  <Text style={styles.infoButtonText}>View Setup Guide</Text>
                </TouchableOpacity>
              </View>

              {/* Shake Sensitivity */}
              <View style={styles.settingSection}>
                <Text style={styles.sectionTitle}>Shake Sensitivity</Text>
                <Text style={styles.sectionDescription}>
                  Current: Medium (recommended)\n
                  Shake your phone firmly to trigger emergency detection.
                </Text>
              </View>

              {/* About */}
              <View style={styles.settingSection}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.sectionDescription}>
                  Drone Rescue System v1.0\n
                  Emergency drone dispatch system with real-time location tracking and Firebase integration.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00D9FF',
    marginBottom: 8,
    letterSpacing: 2,
  },
  settingsIcon: {
    position: 'absolute',
    right: 0,
    padding: 8,
  },
  settingsIconText: {
    fontSize: 28,
  },
  statusBadge: {
    backgroundColor: '#0D3B2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#00D9FF',
  },
  statusText: {
    color: '#00D9FF',
    fontSize: 12,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: '#8B93A7',
    marginBottom: 20,
    textAlign: 'center',
  },
  locationBadge: {
    backgroundColor: '#162447',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1F4788',
  },
  locationText: {
    color: '#00D9FF',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingText: {
    color: '#8B93A7',
    marginTop: 16,
    fontSize: 16,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  button: {
    height: 140,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
  },
  medicalButton: {
    backgroundColor: '#E63946',
    borderColor: '#FF5964',
  },
  fireButton: {
    backgroundColor: '#F77F00',
    borderColor: '#FF9500',
  },
  patrolButton: {
    backgroundColor: '#06AED5',
    borderColor: '#00D9FF',
  },
  buttonIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    color: '#8B93A7',
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A0E27',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderTopWidth: 3,
    borderTopColor: '#00D9FF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1F4788',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00D9FF',
  },
  closeButton: {
    fontSize: 28,
    color: '#8B93A7',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  settingSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8B93A7',
    lineHeight: 20,
    marginBottom: 16,
  },
  settingToggle: {
    backgroundColor: '#162447',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1F4788',
  },
  settingToggleActive: {
    backgroundColor: '#0D3B2E',
    borderColor: '#00D9FF',
  },
  settingToggleIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  settingToggleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tipsList: {
    marginTop: 8,
    marginBottom: 16,
  },
  tipItem: {
    color: '#00D9FF',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  infoButton: {
    backgroundColor: '#1F4788',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00D9FF',
  },
  infoButtonText: {
    color: '#00D9FF',
    fontSize: 14,
    fontWeight: '600',
  },
  sendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  sendingText: {
    color: '#00D9FF',
    fontSize: 14,
    fontWeight: '600',
  },
});
