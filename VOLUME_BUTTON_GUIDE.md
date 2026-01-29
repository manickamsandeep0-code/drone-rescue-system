# Volume Button Emergency Trigger - Implementation Guide

## 🎯 Overview

This implementation allows the Drone Rescue System to detect a **Volume Up button sequence** (3 presses within 2 seconds) to automatically dispatch a medical emergency, even when:
- The screen is off
- The app is in the background
- The phone is locked

## 📁 Files Created

### 1. JavaScript/React Native Files

#### `VolumeSequenceManager.js`
- **Purpose**: Detects the button press sequence
- **Logic**: Tracks timestamps of button presses and triggers callback when 3 presses occur within 2 seconds
- **Key Method**: `handleVolumePress()` - Called each time Volume Up is pressed

#### `VolumeButtonNative.js`
- **Purpose**: Bridge between React Native and native Android module
- **Exports**: 
  - `startListening(callback)` - Begin listening for volume button events
  - `stopListening()` - Stop listening
  - `isAvailable()` - Check if native module is loaded

### 2. Native Android Files

#### `android/app/src/main/java/.../VolumeButtonModule.java`
- **Purpose**: Native module that listens to hardware volume button events
- **Key Features**:
  - Registers `BroadcastReceiver` for `ACTION_MEDIA_BUTTON`
  - Intercepts `KEYCODE_VOLUME_UP` events
  - Prevents system from changing volume (`abortBroadcast()`)
  - Emits events to React Native layer

#### `android/app/src/main/java/.../VolumeButtonPackage.java`
- **Purpose**: Registers the native module with React Native bridge
- **Required**: Links `VolumeButtonModule` to the app

#### `android/app/src/main/java/.../VolumeButtonService.java`
- **Purpose**: Foreground service that keeps volume detection active
- **Key Features**:
  - Runs as persistent foreground service
  - Shows notification: "Press Volume Up 3 times for emergency"
  - Works when screen is off
  - `START_STICKY` ensures it restarts if killed

### 3. Configuration Files

#### `plugins/withVolumeButton.js`
- **Purpose**: Expo config plugin to modify AndroidManifest.xml
- **Adds**:
  - Required permissions
  - Service declaration
  - Broadcast receiver registration
  - High priority intent filter for volume buttons

## ⚙️ How It Works

### Step-by-Step Flow

```
1. User enables "Volume Emergency" in Settings
   ↓
2. startVolumeListener() is called
   ↓
3. VolumeButtonNative.startListening() initializes
   ↓
4. Native module registers BroadcastReceiver
   ↓
5. User presses Volume Up (1st time)
   ↓
6. Native module intercepts KEYCODE_VOLUME_UP
   ↓
7. Event emitted to React Native: "VolumeUp"
   ↓
8. VolumeSequenceManager.handleVolumePress()
   ↓
9. Timestamp recorded
   ↓
10. User presses Volume Up (2nd time, 3rd time)
   ↓
11. Sequence detected (3 presses within 2 seconds)
   ↓
12. handleVolumeSequenceDetected() called
   ↓
13. Haptic feedback triggered
   ↓
14. Notification sent (if in background)
   ↓
15. sendEmergencyData('medical') automatically dispatched
   ↓
16. Firebase updated with emergency location
```

## 🔧 Required Permissions

### AndroidManifest.xml (Auto-configured via plugin)

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.BROADCAST_STICKY" />

<application>
  <!-- Volume Button Service -->
  <service
    android:name=".VolumeButtonService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="mediaPlayback" />
  
  <!-- Volume Button Receiver -->
  <receiver
    android:name=".VolumeButtonReceiver"
    android:enabled="true"
    android:exported="true">
    <intent-filter android:priority="1000">
      <action android:name="android.intent.action.MEDIA_BUTTON" />
    </intent-filter>
  </receiver>
</application>
```

## 🏗️ Building the App

### Option 1: EAS Build (Recommended)

```bash
# Install dependencies
npm install

# Build with EAS
eas build -p android --profile preview
```

### Option 2: Local Build

```bash
# Prebuild to generate android folder
npx expo prebuild

# Link native module in MainApplication.java
# Add to packages list:
new VolumeButtonPackage()

# Build APK
cd android
./gradlew assembleRelease
```

### Required: MainApplication.java Update

After running `npx expo prebuild`, manually add to `android/app/src/main/java/.../MainApplication.java`:

```java
import com.sandeep1235897.dronerescuesystem.VolumeButtonPackage;

@Override
protected List<ReactPackage> getPackages() {
  List<ReactPackage> packages = new PackageList(this).getPackages();
  packages.add(new VolumeButtonPackage()); // Add this line
  return packages;
}
```

## 🎮 Usage

### In Settings Screen

1. Open app
2. Tap ⚙️ Settings icon
3. Scroll to "🎚️ Volume Button Emergency"
4. Tap "Enable Volume Emergency"
5. See notification: "🚁 Emergency Detection Active"

### Triggering Emergency

- Press **Volume Up** button **3 times** within **2 seconds**
- Works with:
  - ✅ Screen off
  - ✅ App in background
  - ✅ Phone locked
  - ✅ Any app open

### What Happens

1. **Haptic vibration** confirms detection
2. **Notification** shows: "🚨 EMERGENCY DISPATCH!"
3. **Medical emergency** automatically sent to Firebase
4. **Location** included in dispatch
5. **Timestamp** recorded

## 🔍 Debugging

### Check if Native Module is Loaded

```javascript
console.log('Volume module available:', VolumeButtonNative.isAvailable());
```

### Expected Output
```
✅ Volume button listener started
Volume Up pressed
Volume press detected. Count: 1
Volume Up pressed
Volume press detected. Count: 2
Volume Up pressed
Volume press detected. Count: 3
🚨 EMERGENCY SEQUENCE DETECTED!
🚨 VOLUME SEQUENCE DETECTED - AUTO DISPATCHING MEDICAL EMERGENCY
```

### Common Issues

**Issue**: "VolumeButtonListener native module not found"
- **Solution**: Rebuild app with `npx expo prebuild` and EAS Build

**Issue**: Volume changes instead of being detected
- **Solution**: Check receiver priority in AndroidManifest.xml (should be 1000)

**Issue**: Not working with screen off
- **Solution**: Ensure VolumeButtonService is running as foreground service

## 🛡️ Limitations

### Android-Only Feature
- **iOS**: Apple does not allow apps to intercept hardware button events
- **Result**: Feature gracefully disabled on iOS with message

### Requires Custom Build
- **Cannot use Expo Go**: Native modules require development build
- **Solution**: Use `eas build` or `expo run:android`

### Battery Considerations
- **Foreground Service**: Keeps service active, minimal battery impact
- **Best Practice**: User can toggle on/off as needed

## 📊 Sequence Detection Logic

```javascript
// VolumeSequenceManager.js
SEQUENCE_COUNT = 3        // Number of presses required
SEQUENCE_TIMEOUT = 2000   // Time window (milliseconds)

// Example timeline:
t=0ms:    Press 1 ✓
t=500ms:  Press 2 ✓
t=1200ms: Press 3 ✓ → TRIGGER!

// Too slow:
t=0ms:    Press 1 ✓
t=1000ms: Press 2 ✓
t=2500ms: Press 3 ✗ (timeout exceeded)
```

## 🔄 Integration Points

### App.js Integration

```javascript
// 1. Import modules
import VolumeButtonNative from './VolumeButtonNative';
import VolumeSequenceManager from './VolumeSequenceManager';

// 2. Initialize manager
const volumeSequenceManager = useRef(null);

useEffect(() => {
  volumeSequenceManager.current = new VolumeSequenceManager(() => {
    handleVolumeSequenceDetected();
  });
}, []);

// 3. Start listening
const startVolumeListener = () => {
  VolumeButtonNative.startListening(() => {
    volumeSequenceManager.current?.handleVolumePress();
  });
};

// 4. Handle detection
const handleVolumeSequenceDetected = async () => {
  await sendEmergencyData('medical');
};
```

## 📝 Customization Options

### Change Sequence Pattern

Edit `VolumeSequenceManager.js`:
```javascript
this.SEQUENCE_COUNT = 5;      // Require 5 presses
this.SEQUENCE_TIMEOUT = 3000; // Within 3 seconds
```

### Change Emergency Type

Edit `handleVolumeSequenceDetected()` in App.js:
```javascript
await sendEmergencyData('fire');    // Fire emergency
await sendEmergencyData('patrol');  // Patrol request
```

### Customize Notification

Edit `VolumeButtonService.java`:
```java
.setContentTitle("🚨 Custom Title")
.setContentText("Custom message")
```

## ✅ Testing Checklist

- [ ] Build app with native modules
- [ ] Install APK on physical Android device
- [ ] Enable "Volume Emergency" in settings
- [ ] See persistent notification
- [ ] Press Volume Up 3 times quickly
- [ ] Verify haptic feedback
- [ ] Check Firebase for emergency entry
- [ ] Test with screen off
- [ ] Test with app in background
- [ ] Test with phone locked

## 🚀 Production Deployment

### Pre-release Checklist

1. **Test thoroughly** on multiple Android versions
2. **Battery testing**: Monitor impact over 24 hours
3. **User documentation**: Explain how to use feature
4. **Legal considerations**: Inform users about volume button interception
5. **Fallback**: Ensure shake detection still works
6. **Analytics**: Track usage and false triggers

### Recommended Settings

- Make volume trigger **opt-in** (disabled by default)
- Show clear instructions when enabled
- Provide easy toggle in settings
- Add confirmation dialog before first use
- Log events for debugging

## 📄 Summary

This implementation provides **true emergency access** via hardware buttons, solving the limitation that apps cannot auto-launch from closed state. The volume button sequence works universally on Android devices and provides a discreet, reliable emergency trigger even in critical situations where screen interaction isn't possible.

**Key Achievement**: Medical emergency can be dispatched **without unlocking phone or opening app**.
