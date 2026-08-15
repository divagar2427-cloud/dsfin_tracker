// Run with: node generate-icons.js
// Generates PWA icons for DS Wealth Tracker

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [32, 72, 96, 128, 144, 152, 192, 384, 512];

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const radius = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#6C63FF');
  grad.addColorStop(1, '#FF6584');

  // Rounded rectangle
  ctx.beginPath();
  ctx.moveTo(cx - size/2 + radius, 0);
  ctx.lineTo(cx + size/2 - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // DS text
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.38}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DS', cx, cy);

  return canvas.toBuffer('image/png');
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

sizes.forEach(size => {
  try {
    const buffer = generateIcon(size);
    fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), buffer);
    console.log(`Generated icon-${size}.png`);
  } catch (e) {
    console.log(`Skipped icon-${size}.png (canvas not available)`);
  }
});