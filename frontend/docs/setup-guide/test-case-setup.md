# Frontend Testing Setup Guide

## Table of Contents
1. [Installation](#installation)
2. [Configuration](#configuration)
3. [File Structure](#file-structure)
4. [Writing Tests](#writing-tests)
5. [Running Tests](#running-tests)
6. [Best Practices](#best-practices)
7. [Common Issues](#common-issues)

---

## Installation

### Step 1: Install Dependencies

```bash
bun add -D vitest happy-dom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**What each package does:**
- `vitest` - Test runner (like Jest but for Vite)
- `happy-dom` - Lightweight DOM implementation
- `@testing-library/react` - React testing utilities
- `@testing-library/jest-dom` - Custom assertions
- `@testing-library/user-event` - Simulates user interactions

---

## Configuration

### Step 2: Setup `vite.config.js`

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,                    // Use test, describe, expect globally
    environment: 'happy-dom',         // Use happy-dom instead of jsdom
    setupFiles: './test/setup.js',   // Run setup before tests
  },
})
```

### Step 3: Setup `test/setup.js`

```javascript
import { afterEach, vi, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Cleanup React components after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia (for responsive design)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Create a REAL localStorage mock that actually stores values
// (not just spy functions - it actually works like real localStorage)
const localStorageMock = (() => {
  let store = {}  // Real storage object

  return {
    getItem: (key) => {
      return store[key] || null  // Returns actual stored value
    },
    setItem: (key, value) => {
      store[key] = String(value)  // Actually stores the value
    },
    removeItem: (key) => {
      delete store[key]  // Actually removes the value
    },
    clear: () => {
      store = {}  // Clears all stored values
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Reset localStorage before each test (clean slate)
beforeEach(() => {
  localStorage.clear()
})
```

**Key Points:**
- ✅ localStorage is a **real working mock**, not just spy functions
- ✅ `getItem()` returns actual stored values
- ✅ `setItem()` actually stores values (used in login tests)
- ✅ `removeItem()` actually removes values (used in logout tests)
- ✅ `clear()` clears all values before each test
- ✅ Tests can check real values: `expect(localStorage.getItem("token")).toBe("fake-jwt-token")`

### Step 4: Update `package.json`

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui"
  }
}
```

---

## File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── login-form.jsx
│   │   ├── signup-form.jsx
│   │   └── __tests__/
│   │       ├── Login.test.jsx
│   │       └── signup-form.test.jsx
│   ├── pages/
│   ├── api/
│   └── ...
├── test/
│   └── setup.js
├── vite.config.js
└── package.json
```

**Test file naming convention:**
- `ComponentName.test.jsx` (for page components)
- `component-name.test.jsx` (for small components)
- Always place in `__tests__/` folder

---

## Writing Tests

### Test Structure (AAA Pattern)

```javascript
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { LoginForm } from "../login-form"
import { login } from "@/api/auth.api"
import { vi } from "vitest"

// Step 1: Mock APIs
vi.mock("@/api/auth.api", () => ({
  login: vi.fn(),
}))

// Step 2: Mock Router
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

// Step 3: Write Tests
describe("LoginForm", () => {
  // ✅ A) ARRANGE - Setup test environment
  test("should render login button", () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    // ✅ B) ACT - User interactions
    // (nothing here - just rendering)

    // ✅ C) ASSERT - Check results
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument()
  })
})
```

### UI Render Tests

```javascript
describe("LoginForm - UI Render Tests", () => {
  test("should render all form elements", () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    // Check if elements exist
    expect(screen.getByPlaceholderText(/m@example.com/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument()
  })
})
```

### Success Flow Tests

```javascript
describe("LoginForm - Login Success Flow", () => {
  test("should save token to localStorage on successful login", async () => {
    const user = userEvent.setup()

    // Mock API success
    login.mockResolvedValueOnce({
      token: "fake-jwt-token",
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    // User fills form
    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "password123")

    // User clicks submit
    await user.click(screen.getByRole("button", { name: /login/i }))

    // Check token saved
    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith("token", "fake-jwt-token")
    })
  })

  test("should show success message on successful login", async () => {
    const user = userEvent.setup()

    login.mockResolvedValueOnce({
      token: "fake-jwt-token",
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "password123")
    await user.click(screen.getByRole("button", { name: /login/i }))

    // Check success message
    await waitFor(() => {
      expect(screen.getByText(/login successful/i)).toBeInTheDocument()
    })
  })
})
```

### Error Flow Tests

```javascript
describe("LoginForm - Login Fail Flow", () => {
  test("should show error message when login fails", async () => {
    const user = userEvent.setup()

    // Mock API failure
    login.mockRejectedValueOnce({
      response: {
        data: {
          message: "Invalid credentials",
        },
      },
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "wrongpassword")
    await user.click(screen.getByRole("button", { name: /login/i }))

    // Check error message
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })

  test("should NOT save token when login fails", async () => {
    const user = userEvent.setup()

    login.mockRejectedValueOnce({
      response: {
        data: {
          message: "Invalid credentials",
        },
      },
    })

    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    )

    await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
    await user.type(screen.getByPlaceholderText(/••••••••/i), "wrongpassword")
    await user.click(screen.getByRole("button", { name: /login/i }))

    // Check token NOT saved
    expect(localStorage.setItem).not.toHaveBeenCalledWith("token", expect.anything())
  })
})
```

---

## Running Tests

### Basic Commands

```bash
# Run tests in watch mode (re-runs on file changes)
bun run test

# Run tests once (CI/CD mode)
bun run test:run

# Run with UI dashboard
bun run test --ui

# Run specific test file
bun run test Login.test.jsx

# Run tests matching pattern
bun run test --grep "should render"
```

### In VS Code

Add to `.vscode/settings.json`:

```json
{
  "vitest.enable": true,
  "vitest.commandLine": "bun run vitest"
}
```

---

## Best Practices

### ✅ DO

```javascript
// 1. Use semantic queries
expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument()

// 2. Use case-insensitive regex
screen.getByText(/login/i)  // matches "Login", "LOGIN", "login"

// 3. Mock APIs
vi.mock("@/api/auth.api", () => ({...}))

// 4. Test user behavior, not implementation
await user.click(button)

// 5. Wait for async operations
await waitFor(() => {
  expect(element).toBeInTheDocument()
})

// 6. Use beforeEach for setup
describe("LoginForm", () => {
  let user
  beforeEach(() => {
    user = userEvent.setup()
  })
})

// 7. Group tests logically
describe("LoginForm - UI Tests", () => {...})
describe("LoginForm - Success Flow", () => {...})
describe("LoginForm - Error Flow", () => {...})
```

### ❌ DON'T

```javascript
// 1. Test implementation details
expect(component.state.isLoading).toBe(true)

// 2. Test without mocking APIs
// (will make real HTTP requests)

// 3. Use hard-coded waits
setTimeout(() => {...}, 1000)

// 4. Test at wrong level
// Test components, not individual functions

// 5. Forget to await async operations
user.click(button)  // ❌ Missing await
await user.click(button)  // ✅ Correct

// 6. Test multiple things in one test
test("login form works", () => {
  // Tests rendering, validation, success, error all at once
})

// 7. Use overly specific selectors
screen.getByTestId("login-btn-id-123")  // Too specific
screen.getByRole("button", { name: /login/i })  // Better
```

---

## Common Issues

### Issue 1: "Cannot find element"

```javascript
// Problem
expect(screen.getByText(/error/i)).toBeInTheDocument()  // Fails immediately

// Solution: Wait for async operations
await waitFor(() => {
  expect(screen.getByText(/error/i)).toBeInTheDocument()
})
```

### Issue 2: "Multiple elements found"

```javascript
// Problem
screen.getByText(/login/i)  // Found in title, description, button

// Solution: Be more specific
screen.getByRole("button", { name: /login/i })
```

### Issue 3: "localStorage is not defined"

```javascript
// Problem: Using real localStorage in tests

// Solution: Already mocked in setup.js
// But verify setup.js is referenced in vite.config.js
```

### Issue 4: "Component not re-rendering"

```javascript
// Problem
await user.type(input, "text")
expect(input.value).toBe("text")  // Fails

// Solution: Let React update first
await user.type(input, "text")
await waitFor(() => {
  expect(input.value).toBe("text")
})
```

### Issue 5: "Navigation not working"

```javascript
// Problem: Testing page components without router

// Solution: Wrap with MemoryRouter
render(
  <MemoryRouter>
    <LoginPage />
  </MemoryRouter>
)
```

---

## Debugging Tests

### Print DOM to see what's rendered

```javascript
import { screen, render } from "@testing-library/react"

test("debug test", () => {
  const { debug } = render(<LoginForm />)
  
  debug()  // Prints entire DOM to console
})
```

### Use screen.logTestingPlaygroundURL()

```javascript
test("debug test", () => {
  render(<LoginForm />)
  
  screen.logTestingPlaygroundURL()  // Get URL to interactive playground
})
```

### Check what queries are available

```javascript
test("debug test", () => {
  render(<LoginForm />)
  
  screen.getAllByRole('*')  // See all accessible roles
})
```

---

## Example: Complete Test File

```javascript
// filepath: src/components/__tests__/Login.test.jsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { LoginForm } from "../login-form"
import { login } from "@/api/auth.api"
import { vi } from "vitest"

vi.mock("@/api/auth.api", () => ({
  login: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

describe("LoginForm", () => {
  describe("UI Render Tests", () => {
    test("should render all form elements", () => {
      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      expect(screen.getByPlaceholderText(/m@example.com/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument()
    })
  })

  describe("Login Success Flow", () => {
    test("should save token on successful login", async () => {
      const user = userEvent.setup()

      login.mockResolvedValueOnce({
        token: "test-token",
      })

      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
      await user.type(screen.getByPlaceholderText(/••••••••/i), "password123")
      await user.click(screen.getByRole("button", { name: /login/i }))

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith("token", "test-token")
      })
    })
  })

  describe("Login Fail Flow", () => {
    test("should show error on failed login", async () => {
      const user = userEvent.setup()

      login.mockRejectedValueOnce({
        response: {
          data: {
            message: "Invalid credentials",
          },
        },
      })

      render(
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      )

      await user.type(screen.getByPlaceholderText(/m@example.com/i), "test@example.com")
      await user.type(screen.getByPlaceholderText(/••••••••/i), "wrongpass")
      await user.click(screen.getByRole("button", { name: /login/i }))

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      })
    })
  })
})
```

---

## Next Steps

1. ✅ Setup files (vite.config.js, test/setup.js)
2. ✅ Write UI render tests
3. ✅ Write success flow tests
4. ✅ Write error flow tests
5. ✅ Run `bun run test`
6. ✅ Add tests to CI/CD pipeline

---

**Happy Testing! 🚀**