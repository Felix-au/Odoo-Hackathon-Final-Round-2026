const fs = require('fs');
const path = require('path');

const imgPath = path.join(__dirname, '../frontend/public/dealflow360_logo.jpg');
const svgPath = path.join(__dirname, '../frontend/public/favicon.svg');
const pngPath = path.join(__dirname, '../frontend/public/favicon.png');
const icoPath = path.join(__dirname, '../frontend/public/favicon.ico');

const b64 = fs.readFileSync(imgPath).toString('base64');

// High resolution SVG favicon with the DealFlow360 3D infinity loop rotated 90deg
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="28" fill="#000000"/>
  <clipPath id="inner">
    <rect x="6" y="6" width="116" height="116" rx="22" />
  </clipPath>
  <g clip-path="url(#inner)">
    <g transform="rotate(90, 64, 64)">
      <image href="data:image/jpeg;base64,${b64}" x="0" y="0" width="128" height="128" preserveAspectRatio="xMidYMid slice" />
    </g>
  </g>
  <rect x="1" y="1" width="126" height="126" rx="27" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
</svg>`;

fs.writeFileSync(svgPath, svgContent);
fs.writeFileSync(pngPath, fs.readFileSync(imgPath));
fs.writeFileSync(icoPath, fs.readFileSync(imgPath));

console.log('✅ Generated favicon.svg, favicon.png, and favicon.ico from dealflow360_logo.jpg');
