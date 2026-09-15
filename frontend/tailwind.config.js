// NOTE: Tailwind v4 (via @tailwindcss/vite, see vite.config.js) does not
// read this file unless referenced with an `@config` directive in CSS,
// which this project doesn't do — the `theme`/`plugins` below are dead and
// only kept for the `content` globs some tooling still expects. Safe-area
// utilities (.safe-ptop/.safe-pbottom/etc.) live in src/index.css instead.
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
    },
  },
}