# shadcn Setup Guide with Bun

## Step 1: Install shadcn Dependencies

Install shadcn and required dependencies:

```bash
bunx --bun shadcn@latest init
```

## Step 2: Update Vite Configuration

Open your `vite.config.js` file and add path alias for imports:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

## Step 3: Create jsconfig.json

Create a `jsconfig.json` file in your project root:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

## Step 4: Initialize shadcn

Run the initialization command:

```bash
bunx --bun shadcn@latest init
```

Follow the prompts and select your preferences (style, color scheme, etc.).

## Step 5: Add Components

Install individual shadcn components as needed:

```bash
bunx shadcn add button
bunx shadcn add input
bunx shadcn add card
bunx shadcn add form
bunx shadcn add label
```

## Step 6: Use shadcn Components

Import and use shadcn components in your React files:

```javascript
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hello shadcn</CardTitle>
      </CardHeader>
      <CardContent>
        <Input placeholder="Type here..." />
        <Button>Click me</Button>
      </CardContent>
    </Card>
  )
}
```

## Step 7: Start Development Server

Run the development server:

```bash
bun run dev
```

shadcn is now ready to use! You can add more components as needed with `bunx shadcn add <component-name>`.

## Common Components to Install

```bash
bunx shadcn@latest add button input card form label separator dialog select textarea checkbox
```

## Optional: Customize Components

All shadcn components are stored in `src/components/ui/` and can be customized to match your design needs.