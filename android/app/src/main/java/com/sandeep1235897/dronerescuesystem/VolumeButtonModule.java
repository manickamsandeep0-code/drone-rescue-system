package com.sandeep1235897.dronerescuesystem;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.view.KeyEvent;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class VolumeButtonModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "VolumeButtonListener";
    private final ReactApplicationContext reactContext;
    private VolumeButtonReceiver volumeReceiver;

    public VolumeButtonModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void startListening() {
        if (volumeReceiver == null) {
            volumeReceiver = new VolumeButtonReceiver();
            IntentFilter filter = new IntentFilter(Intent.ACTION_MEDIA_BUTTON);
            filter.setPriority(IntentFilter.SYSTEM_HIGH_PRIORITY);
            reactContext.registerReceiver(volumeReceiver, filter);
        }
    }

    @ReactMethod
    public void stopListening() {
        if (volumeReceiver != null) {
            try {
                reactContext.unregisterReceiver(volumeReceiver);
                volumeReceiver = null;
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private void sendEvent(String eventName) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, null);
    }

    private class VolumeButtonReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if (Intent.ACTION_MEDIA_BUTTON.equals(action)) {
                KeyEvent event = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                if (event != null && event.getAction() == KeyEvent.ACTION_DOWN) {
                    int keyCode = event.getKeyCode();
                    if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                        sendEvent("VolumeUp");
                        abortBroadcast(); // Prevent system from changing volume
                    }
                }
            }
        }
    }
}
