const sharp = require('sharp');
const fs = require('fs');

async function createIcons() {
  // Create a simple emergency icon with SVG
  const iconSvg = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#bg)" rx="180"/>
      <circle cx="512" cy="512" r="280" fill="#ef4444" opacity="0.2"/>
      <circle cx="512" cy="512" r="220" fill="#ef4444" opacity="0.3"/>
      <ellipse cx="512" cy="512" rx="100" ry="60" fill="#3b82f6"/>
      <circle cx="512" cy="512" r="70" fill="#ef4444"/>
      <text x="512" y="540" font-family="Arial" font-size="48" font-weight="bold" fill="white" text-anchor="middle">SOS</text>
    </svg>
  `;

  const splashSvg = `
    <svg width="1284" height="2778" xmlns="http://www.w3.org/2000/svg">
      <rect width="1284" height="2778" fill="#0A0E27"/>
      <circle cx="642" cy="1200" r="200" fill="#ef4444" opacity="0.2"/>
      <circle cx="642" cy="1200" r="150" fill="#ef4444" opacity="0.3"/>
      <ellipse cx="642" cy="1200" rx="80" ry="48" fill="#3b82f6"/>
      <circle cx="642" cy="1200" r="56" fill="#ef4444"/>
      <text x="642" y="1220" font-family="Arial" font-size="38" font-weight="bold" fill="white" text-anchor="middle">SOS</text>
      <text x="642" y="1450" font-family="Arial" font-size="56" font-weight="bold" fill="#60a5fa" text-anchor="middle">DRONE RESCUE</text>
      <text x="642" y="1530" font-family="Arial" font-size="36" fill="#94a3b8" text-anchor="middle">Emergency Response</text>
    </svg>
  `;

  try {
    if (!fs.existsSync('./assets')) {
      fs.mkdirSync('./assets');
    }

    // Generate icon.png
    await sharp(Buffer.from(iconSvg))
      .resize(1024, 1024)
      .png()
      .toFile('./assets/icon.png');
    console.log('✅ Created icon.png');

    // Generate adaptive-icon.png
    await sharp(Buffer.from(iconSvg))
      .resize(1024, 1024)
      .png()
      .toFile('./assets/adaptive-icon.png');
    console.log('✅ Created adaptive-icon.png');

    // Generate splash.png
    await sharp(Buffer.from(splashSvg))
      .resize(1284, 2778)
      .png()
      .toFile('./assets/splash.png');
    console.log('✅ Created splash.png');

    console.log('\n✨ All icons created successfully!');
  } catch (error) {
    console.error('❌ Error creating icons:', error);
  }
}

createIcons();
