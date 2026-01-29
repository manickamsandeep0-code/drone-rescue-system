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
  TextInput,
  KeyboardAvoidingView,
  FlatList,
  Animated,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Accelerometer } from 'expo-sensors';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { ref, set, serverTimestamp } from 'firebase/database';
import { database } from './firebaseConfig';

// Import AI Voice Assistant with error handling
let AIVoiceAssistant = {
  handleChat: async () => ({ error: 'AI not available' }),
  transcribeAudio: async () => 'AI not available',
  stopSpeech: async () => {},
};

try {
  const importedAI = require('./AIVoiceAssistant').default;
  if (importedAI) {
    AIVoiceAssistant = importedAI;
    console.log('✅ AI Voice Assistant loaded');
  }
} catch (error) {
  console.error('❌ Failed to load AI Voice Assistant:', error);
  Alert.alert('AI Unavailable', 'Voice assistant features will be limited');
}

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

  // AI Voice Assistant states
  const [voiceAssistantVisible, setVoiceAssistantVisible] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Audio recording states
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingAnimation = useRef(new Animated.Value(1)).current;

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

    // Request audio recording permissions and set audio mode
    (async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          console.warn('⚠️ Audio permission not granted');
        }

        // Set audio mode for iOS silent mode and recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });

        console.log('✅ Audio permissions and mode configured');
      } catch (error) {
        console.error('❌ Error setting up audio:', error);
      }
    })();

    // Request location permissions and get current location (optimized for emergency)
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required for this app to function.');
          setLoading(false);
          return;
        }

        // Use lower accuracy for faster initial load, update in background
        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // Faster than High accuracy
        });
        
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        setLoading(false);

        // Get high accuracy location in background for better precision
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }).then(accurateLocation => {
          setLocation({
            latitude: accurateLocation.coords.latitude,
            longitude: accurateLocation.coords.longitude,
          });
        }).catch(err => console.log('High accuracy location update failed:', err));

      } catch (error) {
        console.error('Error getting location:', error);
        // Don't block app loading on location error - allow manual dispatch
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

    // Initialize volume sequence manager
    volumeSequenceManager.current = new VolumeSequenceManager(() => {
      handleVolumeSequenceDetected();
    });

    // Cleanup
    return () => {
      appStateSubscription?.remove();
      subscription.current?.remove();
      VolumeButtonNative.stopListening();
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

  const handleVolumeSequenceDetected = async () => {
    console.log('🚨 VOLUME SEQUENCE DETECTED - AUTO DISPATCHING MEDICAL EMERGENCY');
    
    // Trigger haptic feedback
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Show notification if in background
    if (appState.current !== 'active') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 EMERGENCY DISPATCH!',
          body: 'Volume sequence detected. Medical emergency dispatched!',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null,
      });
    }
    
    // Automatically dispatch medical emergency
    await sendEmergencyData('medical');
  };

  // Start recording audio (hold to record)
  const startRecording = async () => {
    try {
      console.log('🎤 Starting recording...');
      
      // Check permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone permission is needed for voice input.');
        return;
      }

      // Stop any ongoing speech before recording
      await AIVoiceAssistant.stopSpeech();

      // Configure recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);

      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnimation, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(recordingAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Haptic feedback
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      console.log('🎤 Recording started');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  // Stop recording and process audio (release button)
  const stopRecording = async () => {
    try {
      if (!recording) return;

      console.log('🎤 Stopping recording...');
      setIsRecording(false);

      // Stop pulsing animation
      recordingAnimation.stopAnimation();
      recordingAnimation.setValue(1);

      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        Alert.alert('Error', 'No audio recorded');
        return;
      }

      console.log('🎤 Recording stopped, URI:', uri);

      // Haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Transcribe and send to AI
      await transcribeAndSend(uri);

    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      setIsRecording(false);
      recordingAnimation.setValue(1);
      Alert.alert('Error', 'Failed to process recording');
    }
  };

  // Transcribe audio and send to AI
  const transcribeAndSend = async (audioUri) => {
    try {
      setAiLoading(true);

      // Show transcribing message
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: '🎤 Transcribing audio...',
        sender: 'system',
        timestamp: new Date().toISOString(),
      }]);

      // Transcribe audio using Gemini
      const transcribedText = await AIVoiceAssistant.transcribeAudio(audioUri);

      // Remove transcribing message
      setChatMessages(prev => prev.filter(msg => msg.sender !== 'system'));

      if (!transcribedText || transcribedText.trim() === '') {
        Alert.alert('No Speech Detected', 'Please try speaking again.');
        setAiLoading(false);
        return;
      }

      // Add user message to chat
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: transcribedText,
        sender: 'user',
        timestamp: new Date().toISOString(),
      }]);

      // Send to AI
      const response = await AIVoiceAssistant.handleChat(
        transcribedText,
        (aiResponse) => {
          setChatMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            text: aiResponse,
            sender: 'assistant',
            timestamp: new Date().toISOString(),
          }]);
          setAiLoading(false);
        },
        (error) => {
          Alert.alert('AI Error', error);
          setAiLoading(false);
        }
      );

      // Clean up audio file
      await FileSystem.deleteAsync(audioUri, { idempotent: true });

    } catch (error) {
      console.error('❌ Transcription error:', error);
      Alert.alert('Transcription Failed', 'Could not transcribe audio. Please try typing instead.');
      setAiLoading(false);
    }
  };

  // AI Voice Assistant handler
  const handleAIChat = async () => {
    if (!chatInput.trim()) {
      Alert.alert('Empty Message', 'Please type your emergency question.');
      return;
    }

    const userMessage = chatInput.trim();
    setChatInput('');
    setAiLoading(true);

    // Add user message to chat
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: userMessage,
      sender: 'user',
      timestamp: new Date().toISOString(),
    }]);

    try {
      const response = await AIVoiceAssistant.handleChat(
        userMessage,
        (aiResponse) => {
          // Success callback - add AI response to chat
          setChatMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            text: aiResponse,
            sender: 'assistant',
            timestamp: new Date().toISOString(),
          }]);
          setAiLoading(false);
        },
        (error) => {
          // Error callback
          Alert.alert('AI Error', error);
          setAiLoading(false);
        }
      );
    } catch (error) {
      console.error('AI Chat error:', error);
      Alert.alert('Error', 'Failed to get AI response');
      setAiLoading(false);
    }
  };

  const stopAISpeech = () => {
    AIVoiceAssistant.stopSpeech();
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

      {/* AI Voice Assistant Button */}
      <TouchableOpacity
        style={styles.aiAssistantButton}
        onPress={() => setVoiceAssistantVisible(true)}
      >
        <Text style={styles.aiAssistantIcon}>🤖</Text>
        <Text style={styles.aiAssistantText}>AI Emergency Assistant</Text>
      </TouchableOpacity>

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
                  Current: Medium (recommended){'\n'}
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

      {/* AI Voice Assistant Modal */}
      <Modal
        visible={voiceAssistantVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setVoiceAssistantVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.aiModalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.aiHeader}>
            <View style={styles.aiHeaderTop}>
              <Text style={styles.aiTitle}>🤖 AI Emergency Assistant</Text>
              <TouchableOpacity onPress={() => setVoiceAssistantVisible(false)}>
                <Text style={styles.aiCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.aiSubtitle}>Powered by Gemini 2.5 Flash</Text>
          </View>

          {/* Chat Messages */}
          <FlatList
            data={chatMessages}
            keyExtractor={(item) => item.id}
            style={styles.chatList}
            contentContainerStyle={styles.chatListContent}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.chatBubble,
                  item.sender === 'user' ? styles.userBubble : 
                  item.sender === 'system' ? styles.systemBubble : styles.aiBubble
                ]}
              >
                <Text style={styles.chatSender}>
                  {item.sender === 'user' ? '👤 You' : 
                   item.sender === 'system' ? '⚙️ System' : '🤖 AI Assistant'}
                </Text>
                <Text style={styles.chatText}>{item.text}</Text>
                <Text style={styles.chatTimestamp}>
                  {new Date(item.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatIcon}>🚑</Text>
                <Text style={styles.emptyChatText}>
                  Ask me for emergency instructions!
                </Text>
                <Text style={styles.emptyChatHint}>
                  Examples: "What to do for a heart attack?" or "Fire safety tips"
                </Text>
              </View>
            }
          />

          {/* Loading Indicator */}
          {aiLoading && (
            <View style={styles.aiLoadingContainer}>
              <ActivityIndicator size="small" color="#00D9FF" />
              <Text style={styles.aiLoadingText}>AI is thinking...</Text>
            </View>
          )}

          {/* Input Area */}
          <View style={styles.aiInputContainer}>
            <TextInput
              style={styles.aiInput}
              placeholder="Ask emergency question..."
              placeholderTextColor="#64748b"
              value={chatInput}
              onChangeText={setChatInput}
              multiline
              maxLength={500}
              editable={!aiLoading && !isRecording}
            />
            
            {/* Microphone Button */}
            <Animated.View
              style={[
                styles.aiMicButton,
                isRecording && styles.aiMicButtonRecording,
                { transform: [{ scale: recordingAnimation }] }
              ]}
            >
              <TouchableOpacity
                onPressIn={startRecording}
                onPressOut={stopRecording}
                disabled={aiLoading}
                style={styles.aiMicButtonTouch}
              >
                <Text style={styles.aiMicIcon}>
                  {isRecording ? '⏸' : '🎤'}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              style={[styles.aiSendButton, (aiLoading || isRecording) && styles.aiSendButtonDisabled]}
              onPress={handleAIChat}
              disabled={aiLoading || isRecording}
            >
              <Text style={styles.aiSendIcon}>➤</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.aiStopButton}
              onPress={stopAISpeech}
            >
              <Text style={styles.aiStopIcon}>🔇</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  // AI Voice Assistant Styles
  aiAssistantButton: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: '#a78bfa',
  },
  aiAssistantIcon: {
    fontSize: 24,
  },
  aiAssistantText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  aiModalContainer: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  aiHeader: {
    backgroundColor: '#162447',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#8b5cf6',
  },
  aiHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#a78bfa',
  },
  aiCloseButton: {
    fontSize: 28,
    color: '#8B93A7',
    fontWeight: 'bold',
  },
  aiSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    padding: 16,
    paddingBottom: 80,
  },
  chatBubble: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: '#1e3a8a',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#7c3aed',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  systemBubble: {
    backgroundColor: '#0f766e',
    alignSelf: 'center',
    maxWidth: '70%',
  },
  chatSender: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  chatText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
    marginBottom: 6,
  },
  chatTimestamp: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyChatIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyChatText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyChatHint: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  aiLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#162447',
    gap: 8,
  },
  aiLoadingText: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '600',
  },
  aiInputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#162447',
    borderTopWidth: 2,
    borderTopColor: '#1F4788',
    gap: 8,
  },
  aiInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    fontSize: 16,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#334155',
  },
  aiMicButton: {
    backgroundColor: '#10b981',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  aiMicButtonRecording: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  aiMicButtonTouch: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiMicIcon: {
    fontSize: 24,
  },
  aiSendButton: {
    backgroundColor: '#8b5cf6',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiSendButtonDisabled: {
    backgroundColor: '#4c1d95',
    opacity: 0.5,
  },
  aiSendIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  aiStopButton: {
    backgroundColor: '#ef4444',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiStopIcon: {
    fontSize: 20,
  },
});
