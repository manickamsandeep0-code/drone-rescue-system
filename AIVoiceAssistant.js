/**
 * AI Voice Assistant Module
 * Integrates Gemini 2.5 Flash for emergency rescue assistance with voice output
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as Speech from 'expo-speech';
import { database } from './firebaseConfig';
import { ref, push, serverTimestamp } from 'firebase/database';
import { GEMINI_API_KEY } from './config';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// System prompt for emergency rescue assistant
const SYSTEM_INSTRUCTION = `You are an Emergency Rescue Assistant. Provide immediate, calm, and concise (max 2 sentences) life-saving instructions. If the user mentions a specific disaster, suggest they press the corresponding button on the dashboard.`;

class AIVoiceAssistant {
  constructor() {
    this.model = null;
    this.chat = null;
    this.isLoading = false;
    this.conversationHistory = [];
    this.initializeModel();
  }

  /**
   * Initialize Gemini model with emergency rescue system instructions
   */
  initializeModel() {
    try {
      this.model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: SYSTEM_INSTRUCTION,
      });

      // Start a new chat session
      this.chat = this.model.startChat({
        history: [],
        generationConfig: {
          maxOutputTokens: 100, // Keep responses concise
          temperature: 0.7,
        },
      });

      console.log('✅ Gemini AI initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI:', error);
    }
  }

  /**
   * Handle chat interaction with Gemini
   * @param {string} userMessage - User's text input
   * @param {Function} onResponse - Callback with AI response
   * @param {Function} onError - Error callback
   * @returns {Promise<string>} AI response text
   */
  async handleChat(userMessage, onResponse = null, onError = null) {
    if (!this.chat) {
      const error = 'AI model not initialized';
      console.error('❌', error);
      if (onError) onError(error);
      return null;
    }

    if (this.isLoading) {
      console.warn('⚠️ Chat is already processing a message');
      return null;
    }

    try {
      this.isLoading = true;

      // Send message to Gemini
      console.log('📤 Sending to Gemini:', userMessage);
      const result = await this.chat.sendMessage(userMessage);
      const responseText = result.response.text();

      console.log('📥 Gemini response:', responseText);

      // Add to conversation history
      this.conversationHistory.push({
        user: userMessage,
        assistant: responseText,
        timestamp: new Date().toISOString(),
      });

      // Automatically speak the response
      await this.speakResponse(responseText);

      // Check for emergency keywords and log to Firebase
      await this.checkAndLogEmergency(userMessage, responseText);

      // Call response callback
      if (onResponse) {
        onResponse(responseText);
      }

      this.isLoading = false;
      return responseText;

    } catch (error) {
      console.error('❌ Error in handleChat:', error);
      this.isLoading = false;
      
      if (onError) {
        onError(error.message || 'Failed to get AI response');
      }
      
      return null;
    }
  }

  /**
   * Use expo-speech to read the response aloud
   * @param {string} text - Text to speak
   */
  async speakResponse(text) {
    try {
      // Stop any ongoing speech first
      await Speech.stop();

      // Speak the response with emergency-appropriate voice settings
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9, // Slightly slower for clarity in emergencies
        voice: 'com.apple.ttsbundle.Samantha-compact', // Clear female voice
        onDone: () => console.log('🔊 Speech completed'),
        onStopped: () => console.log('⏹️ Speech stopped'),
        onError: (error) => console.error('❌ Speech error:', error),
      });

      console.log('🔊 Speaking response:', text);
    } catch (error) {
      console.error('❌ Error in speakResponse:', error);
    }
  }

  /**
   * Stop any ongoing speech
   */
  async stopSpeech() {
    try {
      await Speech.stop();
      console.log('⏹️ Speech stopped by user');
    } catch (error) {
      console.error('❌ Error stopping speech:', error);
    }
  }

  /**
   * Check if the conversation mentions emergency types or locations
   * and log to Firebase if detected
   * @param {string} userMessage - User's message
   * @param {string} aiResponse - AI's response
   */
  async checkAndLogEmergency(userMessage, aiResponse) {
    try {
      const combinedText = `${userMessage} ${aiResponse}`.toLowerCase();

      // Emergency type detection
      const emergencyTypes = {
        medical: ['medical', 'injury', 'injured', 'bleeding', 'unconscious', 'heart attack', 'seizure', 'allergic'],
        fire: ['fire', 'smoke', 'burning', 'flames', 'explosion', 'gas leak'],
        patrol: ['suspicious', 'intruder', 'surveillance', 'patrol', 'security', 'break-in', 'trespassing'],
      };

      let detectedType = null;
      for (const [type, keywords] of Object.entries(emergencyTypes)) {
        if (keywords.some(keyword => combinedText.includes(keyword))) {
          detectedType = type;
          break;
        }
      }

      // Location detection (simple pattern matching)
      const locationPatterns = [
        /at\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, // "at Location Name"
        /in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, // "in Location Name"
        /near\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, // "near Location Name"
      ];

      let detectedLocation = null;
      for (const pattern of locationPatterns) {
        const match = userMessage.match(pattern);
        if (match && match[1]) {
          detectedLocation = match[1];
          break;
        }
      }

      // Log to Firebase if emergency detected
      if (detectedType || detectedLocation) {
        const emergencyData = {
          type: detectedType || 'unknown',
          location: detectedLocation || 'Not specified',
          userMessage: userMessage,
          aiResponse: aiResponse,
          timestamp: serverTimestamp(),
          source: 'AI Voice Assistant',
        };

        const emergencyRef = ref(database, 'emergency_events');
        await push(emergencyRef, emergencyData);

        console.log('🚨 Emergency logged to Firebase:', emergencyData);
      }

    } catch (error) {
      console.error('❌ Error checking/logging emergency:', error);
    }
  }

  /**
   * Get loading state
   * @returns {boolean}
   */
  getLoadingState() {
    return this.isLoading;
  }

  /**
   * Get conversation history
   * @returns {Array}
   */
  getHistory() {
    return this.conversationHistory;
  }

  /**
   * Clear conversation history and restart chat
   */
  clearHistory() {
    this.conversationHistory = [];
    this.initializeModel(); // Restart chat session
    console.log('🔄 Conversation history cleared');
  }

  /**
   * Check if speech is available on the device
   * @returns {Promise<boolean>}
   */
  async isSpeechAvailable() {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      return voices && voices.length > 0;
    } catch (error) {
      console.error('❌ Error checking speech availability:', error);
      return false;
    }
  }
}

// Export singleton instance
export default new AIVoiceAssistant();
