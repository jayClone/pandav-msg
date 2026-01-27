import React, { useState } from 'react'
import { X, Moon, Sun, Palette } from 'lucide-react'

export default function ThemeChanger({ isOpen, onClose, onThemeChange }) {
  const [selectedTheme, setSelectedTheme] = useState('dark')

  const themes = {
    dark: {
      name: 'Dark',
      bg: 'linear-gradient(135deg, rgba(0,20,40,0.95) 0%, rgba(15,35,60,0.95) 100%)',
      color: '#000000',
      fontFamily: "'Inter', sans-serif",
      fontSize: '14px',
      fontWeight: '500'
    },
    forest: {
      name: 'Forest',
      bg: 'linear-gradient(135deg, rgba(34,139,34,0.15) 0%, rgba(0,50,0,0.2) 100%)',
      color: '#228b22',
      fontFamily: "'Segoe UI', sans-serif",
      fontSize: '15px',
      fontWeight: '600'
    },
    ocean: {
      name: 'Ocean',
      bg: 'linear-gradient(135deg, #001a4d 0%, #003d99 50%, #0066cc 100%)',
      color: '#0066cc',
      fontFamily: "'Poppins', sans-serif",
      fontSize: '14px',
      fontWeight: '500'
    },
    minimal: {
      name: 'Minimal',
      bg: 'linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)',
      color: '#1a1f3a',
      fontFamily: "'Helvetica Neue', sans-serif",
      fontSize: '13px',
      fontWeight: '400'
    },
    night: {
      name: 'Night',
      bg: 'linear-gradient(135deg, #0d0221 0%, #14213d 100%)',
      color: '#0d0221',
      fontFamily: "'Roboto', sans-serif",
      fontSize: '15px',
      fontWeight: '500'
    }
  }

  const handleApplyTheme = () => {
    onThemeChange(selectedTheme)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      {/* Modal Container */}
      <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl shadow-2xl border border-[rgb(var(--border-secondary))] max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-linear-to-r from-green-600/20 to-emerald-600/20 px-6 py-4 border-b border-[rgb(var(--border-secondary))] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Palette className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-bold text-gray-300">Change Theme</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-red-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          
          {/* Theme Grid */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(themes).map(([key, theme]) => (
              <button
                key={key}
                onClick={() => setSelectedTheme(key)}
                className={`group relative p-4 rounded-xl border-2 transition-all overflow-hidden ${
                  selectedTheme === key
                    ? 'border-green-500 shadow-lg glow-green'
                    : 'border-gray-600 hover:border-green-500/50'
                }`}
              >
                {/* Background Preview */}
                <div
                  className="absolute inset-0 rounded-lg"
                  style={{ background: theme.bg }}
                />

                {/* Content */}
                <div className="relative z-10 text-center">
                  <div
                    className="w-8 h-8 rounded-full mx-auto mb-2 shadow-lg border-2 border-white/20"
                    style={{ background: theme.color }}
                  />
                  <p className="text-xs font-semibold text-white drop-shadow-lg">
                    {theme.name}
                  </p>
                </div>

                {/* Selected Indicator */}
                {selectedTheme === key && (
                  <div className="absolute inset-0 border-2 border-green-400 rounded-lg glow-green" />
                )}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl border border-[rgb(var(--border-secondary))] bg-[rgb(var(--bg-tertiary))]/50">
            <p className="text-xs text-gray-400 mb-2">Preview:</p>
            <div
              className="h-24 rounded-lg border border-[rgb(var(--border-secondary))] shadow-lg"
              style={{ background: themes[selectedTheme].bg }}
            />
          </div>

          {/* Theme Description */}
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30">
            <p className="text-xs text-green-300">
              <span className="font-semibold">Selected:</span> {themes[selectedTheme].name}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[rgb(var(--bg-tertiary))]/50 border-t border-[rgb(var(--border-secondary))] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-gray-400 hover:text-gray-300 hover:bg-[rgb(var(--bg-hover))] transition-all font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyTheme}
            className="flex-1 px-4 py-2.5 rounded-lg bg-linear-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white font-semibold transition-all shadow-lg glow-green"
          >
            Apply Theme
          </button>
        </div>
      </div>
    </div>
  )
}
