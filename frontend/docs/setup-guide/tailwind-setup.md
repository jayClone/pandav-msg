# Tailwind CSS v4 Setup Guide with Bun

## Step 1: Install Tailwind CSS and Vite Plugin

Install Tailwind CSS v4 with the official Vite plugin:

```bash
bun add -D tailwindcss @tailwindcss/vite
```

## Step 2: Update Vite Configuration

Open your `vite.config.js` file and add the Tailwind plugin:

```javascript
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
})
```

## Step 3: Update CSS File

Open your main CSS file (`src/index.css`) and replace its content with:

```css
@import "tailwindcss";
```

> **Note:** Tailwind v4 uses a single `@import` statement instead of three separate `@tailwind` directives.

## Step 4: Configure Package Scripts

Ensure your `package.json` uses the `--bun` flag for faster builds:

```json
{
  "scripts": {
    "dev": "bunx --bun vite",
    "build": "bunx --bun vite build",
    "preview": "bunx --bun vite preview",
    "lint": "eslint ."
  }
}
```

## Step 5: Verify CSS Import

Make sure your main entry file (`src/main.jsx`) imports the CSS:

```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

## Step 6: Start Development Server

Run the development server:

```bash
bun run dev
```

Tailwind CSS is now ready to use! Start adding Tailwind classes to your React components.

## Optional: Customize Tailwind

Create a `tailwind.config.js` file for custom configuration:

```javascript
export default {
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
      },
    },
  },
}
```