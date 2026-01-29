# AI Voice Assistant Integration

## Overview
The Drone Rescue System now includes an **AI Voice Assistant** powered by Google's Gemini 2.5 Flash model with automatic voice responses using expo-speech.

## Features

### 🤖 Gemini AI Integration
- Uses `@google/generative-ai` SDK
- Model: `gemini-2.0-flash-exp`
- Specialized system prompt for emergency rescue assistance
- Concise responses (max 2 sentences) for quick guidance

### 🔊 Voice Output
- Automatic text-to-speech using `expo-speech`
- Clear, calm voice suitable for emergencies
- Stop speech button for manual control

### 🚨 Firebase Integration
- Auto-detects emergency types (medical, fire, patrol)
- Logs conversations with emergency keywords to `/emergency_events`
- Location extraction from user messages

### 💬 Chat Interface
- Real-time chat bubbles
- Message history
- Loading states during AI processing
- Input validation

## Setup Instructions

### 1. Get Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated key

### 2. Configure API Key
Open `config.js` and replace the placeholder:

```javascript
export const GEMINI_API_KEY = 'your-actual-api-key-here';
```

### 3. Dependencies
Already installed:
```bash
npx expo install @google/generative-ai expo-speech
```

## File Structure

```
victory/
├── AIVoiceAssistant.js       # Main AI logic module
├── config.js                 # API key configuration
├── firebaseConfig.js         # Shared Firebase config
└── App.js                    # Main app with UI integration
```

## Usage

### Opening the Assistant
Tap the **"🤖 AI Emergency Assistant"** button at the bottom of the main screen.

### Asking Questions
Examples:
- "What to do for a heart attack?"
- "Fire safety tips"
- "How to treat a burn?"
- "Someone is unconscious, what should I do?"

### Emergency Detection
The AI automatically:
1. Detects emergency type from keywords
2. Extracts location mentions
3. Logs to Firebase at `/emergency_events`
4. Suggests pressing dashboard buttons for dispatch

### Voice Control
- **Automatic**: AI responses are spoken immediately
- **Manual Stop**: Tap 🔇 button to stop speech

## Code Examples

### Basic Chat Usage
```javascript
await AIVoiceAssistant.handleChat(
  "What to do for chest pain?",
  (response) => console.log("AI:", response),
  (error) => console.error("Error:", error)
);
```

### Stop Speech
```javascript
AIVoiceAssistant.stopSpeech();
```

### Check Loading State
```javascript
const isLoading = AIVoiceAssistant.getLoadingState();
```

### Get Conversation History
```javascript
const history = AIVoiceAssistant.getHistory();
```

## Firebase Data Structure

Emergency events logged to `/emergency_events`:
```json
{
  "type": "medical",
  "location": "Main Street",
  "userMessage": "Heart attack at Main Street!",
  "aiResponse": "Call 911 immediately. Begin CPR if trained...",
  "timestamp": 1706486400000,
  "source": "AI Voice Assistant"
}
```

## System Prompt

```
You are an Emergency Rescue Assistant. Provide immediate, calm, 
and concise (max 2 sentences) life-saving instructions. If the 
user mentions a specific disaster, suggest they press the 
corresponding button on the dashboard.
```

## Limitations

1. **Requires Internet**: AI needs network connection
2. **API Key Required**: Must configure valid Gemini API key
3. **Voice Availability**: TTS depends on device voices
4. **Token Limits**: Long conversations may hit API limits

## Testing

1. Open the AI Assistant modal
2. Type: "What to do for a broken arm?"
3. Verify:
   - AI response appears in chat
   - Response is spoken aloud
   - Message bubbles display correctly
   - Loading indicator shows during processing

## Troubleshooting

### "AI model not initialized"
- Check `config.js` has valid API key
- Verify internet connection

### No voice output
- Check device volume
- Test with: `await Speech.speak("Test")`
- Verify expo-speech permissions

### Firebase not logging
- Check Firebase rules allow writes to `/emergency_events`
- Verify Firebase credentials in `firebaseConfig.js`

## API Key Security

**IMPORTANT**: Never commit `config.js` with real API keys to public repositories!

Add to `.gitignore`:
```
config.js
```

Use environment variables for production:
```javascript
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
```

## Next Steps

1. Replace placeholder API key in `config.js`
2. Test emergency detection with various queries
3. Customize system prompt if needed
4. Add more emergency type keywords
5. Build and deploy the app

---

**Built with ❤️ for emergency rescue operations**
