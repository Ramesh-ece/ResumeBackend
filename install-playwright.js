// install-playwright.js
const { execSync } = require('child_process');

console.log('Installing Playwright browsers...');
execSync('npx playwright install', { stdio: 'inherit' });

console.log('Playwright browsers installed successfully!');
