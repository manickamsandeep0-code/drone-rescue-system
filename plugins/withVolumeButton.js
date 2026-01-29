const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withVolumeButton(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // Add permissions
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.BROADCAST_STICKY',
    ];

    permissions.forEach((permission) => {
      if (
        !androidManifest['uses-permission'].find(
          (p) => p.$['android:name'] === permission
        )
      ) {
        androidManifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    });

    // Add service declaration
    const application = androidManifest.application[0];
    
    if (!application.service) {
      application.service = [];
    }

    // Add VolumeButtonService
    application.service.push({
      $: {
        'android:name': '.VolumeButtonService',
        'android:enabled': 'true',
        'android:exported': 'false',
        'android:foregroundServiceType': 'mediaPlayback',
      },
    });

    // Add receiver for volume button
    if (!application.receiver) {
      application.receiver = [];
    }

    application.receiver.push({
      $: {
        'android:name': '.VolumeButtonReceiver',
        'android:enabled': 'true',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          $: {
            'android:priority': '1000',
          },
          action: [
            {
              $: {
                'android:name': 'android.intent.action.MEDIA_BUTTON',
              },
            },
          ],
        },
      ],
    });

    return config;
  });
};
