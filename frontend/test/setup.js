// This runs BEFORE every test
import { afterEach, vi, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Cleanup React components after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia
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

// Create a real localStorage mock that actually stores values
const localStorageMock = (() => {
  let store = {}  // ← Real storage object

  return {
    getItem: (key) => {
      return store[key] || null  // ← Returns actual value
    },
    setItem: (key, value) => {
      store[key] = String(value)  // ← Actually stores value
    },
    removeItem: (key) => {
      delete store[key]  // ← Actually removes value
    },
    clear: () => {
      store = {}  // ← Clears all values
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Reset storage before each test
beforeEach(() => {
  localStorage.clear()
})
