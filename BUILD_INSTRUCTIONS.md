# 🚁 Building Drone Rescue with Volume Button Support

## Quick Build Instructions

### Prerequisites
```bash
npm install
```

### Build with EAS (Recommended)

```bash
# First time setup
eas login
eas build:configure

# Build APK with native modules
eas build -p android --profile preview
```

### What's Included

This build includes:
- ✅ Volume button sequence detection (3 presses = auto medical dispatch)
- ✅ Background shake detection
- ✅ Firebase integration
- ✅ Settings screen
- ✅ All native Android modules

### After Building

1. Download APK from EAS build link
2. Install on Android device
3. Grant all permissions
4. Open Settings ⚙️
5. Enable "Volume Emergency"
6. Press Volume Up 3x quickly to test

### Important Notes

⚠️ **This feature requires a custom development build** - it will NOT work in Expo Go

⚠️ **Android only** - iOS doesn't allow hardware button interception

✅ **Works with screen off** - True emergency access

## File Structure

```
victory/
├── App.js                          # Main app with volume integration
├── VolumeButtonNative.js           # Native module bridge
├── VolumeSequenceManager.js        # Sequence detection logic
├── plugins/
│   └── withVolumeButton.js         # Expo config plugin
├── android/app/src/main/java/.../
│   ├── VolumeButtonModule.java     # Native Android module
│   ├── VolumeButtonPackage.java    # Module registration
│   └── VolumeButtonService.java    # Foreground service
├── VOLUME_BUTTON_GUIDE.md          # Complete documentation
└── BUILD_INSTRUCTIONS.md           # This file
```

## Troubleshooting

**Native module not found?**
- Ensure you're using a development build, not Expo Go
- Rebuild with `eas build`

**Volume still changes volume?**
- Check AndroidManifest.xml receiver priority
- Ensure service is running (check notifications)

**Not working with screen off?**
- Verify foreground service permission
- Check Settings → Apps → Drone Rescue → Battery → Unrestricted

## Support

See `VOLUME_BUTTON_GUIDE.md` for complete implementation details.
