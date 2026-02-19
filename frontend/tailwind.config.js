export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ✅ ADD xs BREAKPOINT FOR ULTRA-SMALL DEVICES
      screens: {
        'xs': '380px',
      },
      // ✅ ADD SAFE AREA SUPPORT FOR iOS NOTCH
      spacing: {
        'safe': 'max(1rem, env(safe-area-inset-bottom))',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        'safe-top': 'env(safe-area-inset-top)',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.safe-pbottom': {
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        },
        '.safe-ptop': {
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
        },
        '.safe-pleft': {
          paddingLeft: 'env(safe-area-inset-left)',
        },
        '.safe-pright': {
          paddingRight: 'env(safe-area-inset-right)',
        },
      });
    },
  ],
}