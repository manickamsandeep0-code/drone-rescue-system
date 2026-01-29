/**
 * VolumeButtonNative
 * Native module wrapper for volume button detection
 */

import { Platform, NativeModules, DeviceEventEmitter } from 'react-native';

const { VolumeButtonListener } = NativeModules;

let volumeUpListener = null;

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

    if (!VolumeButtonListener) {
      console.error('❌ VolumeButtonListener native module not found');
      return;
    }

    // Remove existing listener
    if (volumeUpListener) {
      volumeUpListener.remove();
    }

    // Listen for VolumeUp events from native module
    volumeUpListener = DeviceEventEmitter.addListener('VolumeUp', () => {
      if (onVolumeUp) {
        onVolumeUp();
      }
    });

    // Start native listener
    VolumeButtonListener.startListening();
    console.log('✅ Volume button listener started');
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
    }

    // Stop native listener
    VolumeButtonListener.stopListening();
    console.log('⏹️ Volume button listener stopped');
  },

  /**
   * Check if native module is available
   */
  isAvailable: () => {
    return Platform.OS === 'android' && VolumeButtonListener !== undefined;
  },
};

export default VolumeButtonNative;
