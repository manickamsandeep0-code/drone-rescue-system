/**
 * VolumeSequenceManager
 * Detects volume button sequences (3 presses within 2 seconds)
 */

class VolumeSequenceManager {
  constructor(onSequenceDetected) {
    this.onSequenceDetected = onSequenceDetected;
    this.pressTimestamps = [];
    this.SEQUENCE_COUNT = 3;
    this.SEQUENCE_TIMEOUT = 2000; // 2 seconds
  }

  handleVolumePress() {
    const now = Date.now();
    
    // Add current timestamp
    this.pressTimestamps.push(now);
    
    // Remove timestamps older than SEQUENCE_TIMEOUT
    this.pressTimestamps = this.pressTimestamps.filter(
      timestamp => now - timestamp < this.SEQUENCE_TIMEOUT
    );
    
    console.log(`Volume press detected. Count: ${this.pressTimestamps.length}`);
    
    // Check if sequence is complete
    if (this.pressTimestamps.length >= this.SEQUENCE_COUNT) {
      console.log('🚨 EMERGENCY SEQUENCE DETECTED!');
      this.pressTimestamps = []; // Reset
      this.onSequenceDetected();
    }
  }

  reset() {
    this.pressTimestamps = [];
  }
}

export default VolumeSequenceManager;
