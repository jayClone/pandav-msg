export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ✅ ADD SAFE AREA SUPPORT FOR iOS NOTCH
      spacing: {
        'safe': 'max(1rem, env(safe-area-inset-bottom))',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        'safe-top': 'env(safe-area-inset-top)',
      },
    },
  },
  plugins: [],
}