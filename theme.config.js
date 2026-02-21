/** @type {const} */
const themeColors = {
  // Dark glassmorphism theme matching the HTML calculator
  primary: { light: '#00d2ff', dark: '#00d2ff' },       // accent-primary (cyan)
  background: { light: '#030708', dark: '#030708' },     // body background
  surface: { light: 'rgba(255,255,255,0.03)', dark: 'rgba(255,255,255,0.03)' }, // glass-bg
  foreground: { light: '#e0e0e0', dark: '#e0e0e0' },    // text-main
  muted: { light: '#999999', dark: '#999999' },          // text-dim
  border: { light: 'rgba(255,255,255,0.12)', dark: 'rgba(255,255,255,0.12)' }, // glass-border
  success: { light: '#00f2fe', dark: '#00f2fe' },        // success (cyan)
  warning: { light: '#f9d423', dark: '#f9d423' },        // warning (yellow)
  error: { light: '#ff4b2b', dark: '#ff4b2b' },          // danger (red)
};

module.exports = { themeColors };
