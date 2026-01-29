/**
 * VolumeButtonNative
 * Native module wrapper for volume button detection
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { VolumeButtonListener } = NativeModules;

let eventEmitter = null;
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
      console.error('VolumeButtonListener native module not found. Did you rebuild the app?');
      return;
    }

    // Initialize event emitter
    if (!eventEmitter) {
      eventEmitter = new NativeEventEmitter(VolumeButtonListener);
    }

    // Remove existing listener
    if (volumeUpListener) {
      volumeUpListener.remove();
    }

    // Add new listener
    volumeUpListener = eventEmitter.addListener('VolumeUp', onVolumeUp);

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

    if (VolumeButtonListener) {
      VolumeButtonListener.stopListening();
      console.log('⏹️ Volume button listener stopped');
    }
  },

  /**
   * Check if native module is available
   */
  isAvailable: () => {
    return Platform.OS === 'android' && !!VolumeButtonListener;
  },
};

export default VolumeButtonNative;
