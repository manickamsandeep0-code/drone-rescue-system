/**
 * VolumeButtonNative
 * Native module wrapper for volume button detection using react-native-keyevent
 */

import { Platform, DeviceEventEmitter } from 'react-native';
import ReactNativeKeyEvent from 'react-native-keyevent';

let volumeUpListener = null;
let onVolumeUpCallback = null;

const VolumeButtonNative = {
  /**
   * Start listening for volume button events
   * @param {Function} onVolumeUp - Callback when volume up is pressed
   */
  startListening: (onVolumeUp) => {
    if (Platform.OS !== 'android') {
      console.warn('Volume button detection is only available on Android');
      return;
    }

    onVolumeUpCallback = onVolumeUp;

    // Remove existing listener
    if (volumeUpListener) {
      volumeUpListener.remove();
    }

    // Listen for key events
    volumeUpListener = DeviceEventEmitter.addListener('onKeyDown', (keyEvent) => {
      // KEYCODE_VOLUME_UP = 24
      if (keyEvent.keyCode === 24 && onVolumeUpCallback) {
        onVolumeUpCallback();
      }
    });

    console.log('✅ Volume button listener started (using react-native-keyevent)');
  },

  /**
   * Stop listening for volume button events
   */
  stopListening: () => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (volumeUpListener) {
      volumeUpListener.remove();
      volumeUpListener = null;
      onVolumeUpCallback = null;
    }

    console.log('⏹️ Volume button listener stopped');
  },

  /**
   * Check if native module is available
   */
  isAvailable: () => {
    return Platform.OS === 'android' && ReactNativeKeyEvent !== undefined;
  },
};

export default VolumeButtonNative;
