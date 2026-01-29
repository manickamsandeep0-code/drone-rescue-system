const { withAndroidManifest, withMainApplication, AndroidConfig } = require('@expo/config-plugins');

/**
 * Adds permissions and service declarations to AndroidManifest.xml
 */
function withVolumeButton(config) {
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

/**
 * Adds the VolumeButtonPackage to MainApplication.java
 */
function withVolumeButtonPackage(config) {
  return withMainApplication(config, (config) => {
    const { modResults } = config;
    let contents = modResults.contents;

    // Add import for VolumeButtonPackage
    const packageImport = 'import com.sandeep1235897.dronerescuesystem.VolumeButtonPackage;';
    if (!contents.includes(packageImport)) {
      // Find the package declaration and add import after it
      const packageRegex = /(package com\.sandeep1235897\.dronerescuesystem;)/;
      contents = contents.replace(
        packageRegex,
        `$1\n${packageImport}`
      );
    }

    // Add VolumeButtonPackage to packages list
    const packageAdd = 'packages.add(new VolumeButtonPackage());';
    if (!contents.includes(packageAdd)) {
      // Find the getPackages method and add the package
      // Look for "return packages;" or "return Arrays.asList(" pattern
      const packagesRegex = /(List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);[\s\S]*?)(return packages;)/;
      
      if (packagesRegex.test(contents)) {
        contents = contents.replace(
          packagesRegex,
          `$1      ${packageAdd}\n      $2`
        );
      }
    }

    modResults.contents = contents;
    return config;
  });
}

module.exports = function(config) {
  config = withVolumeButton(config);
  config = withVolumeButtonPackage(config);
  return config;
};
