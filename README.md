# 🚁 Autonomous Drone Rescue System

A React Native Expo application for emergency drone dispatch with real-time Firebase integration.

## Features

- 📍 Real-time GPS location tracking
- 🤝 Shake-to-activate emergency mode
- 📳 Haptic feedback for user confirmation
- 🔥 Three emergency types: Medical, Fire, Surveillance
- 🌙 Professional dark-mode UI
- ☁️ Firebase Realtime Database integration

## Installation

### 1. Install Dependencies

Run the following commands to install all required packages:

```bash
npx expo install expo-location
npx expo install expo-sensors
npx expo install expo-haptics
npx expo install firebase
```

### 2. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable **Realtime Database**
4. Go to Project Settings → General → Your apps
5. Copy your Firebase configuration object
6. Replace the `firebaseConfig` object in `App.js` with your configuration:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL", // Important for Realtime Database
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Set Firebase Database Rules

In your Firebase Realtime Database, set the following rules for testing:

```json
{
  "rules": {
    "drone_status": {
      ".read": true,
      ".write": true
    }
  }
}
```

**Note:** For production, implement proper authentication and security rules.

## Running the App

```bash
# Start the development server
npx expo start

# Run on Android
npx expo start --android

# Run on iOS
npx expo start --ios
```

## Usage

1. **Grant Permissions**: Allow location access when prompted
2. **View Location**: Your current coordinates are displayed at the top
3. **Shake Detection**: Shake your phone to trigger emergency alert
4. **Emergency Dispatch**: Tap any of the three buttons to send emergency data:
   - 🏥 Medical Emergency
   - 🔥 Fire Disaster
   - 👁️ Surveillance Request

## Data Structure

Emergency data sent to Firebase at `/drone_status`:

```json
{
  "type": "medical" | "fire" | "surveillance",
  "lat": 37.7749,
  "long": -122.4194,
  "timestamp": 1706486400000
}
```

## Dependencies

- `expo` - Core Expo framework
- `expo-location` - GPS location services
- `expo-sensors` - Accelerometer for shake detection
- `expo-haptics` - Vibration feedback
- `firebase` - Firebase Realtime Database SDK

## License

MIT
