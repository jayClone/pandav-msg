import React, { useState } from 'react'
import { X, Moon, Sun } from 'lucide-react'

export default function ThemeChanger({ isOpen, onClose, onThemeChange }) {
  const [selectedTheme, setSelectedTheme] = useState('dark')

  const themes = {
    dark: {
      name: 'Dark Theme',
      icon: Moon,
      bg: 'linear-gradient(135deg, rgba(0,20,40,0.95) 0%, rgba(15,35,60,0.95) 100%)',
      color: '#1a1a2e',
      description: 'Professional dark theme for comfortable night viewing'
    },
    light: {
      name: 'Light Theme',
      icon: Sun,
      bg: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)',
      color: '#ffffff',
      description: 'Clean light theme for daytime productivity'
    }
  }

  const handleApplyTheme = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onThemeChange(selectedTheme)
    onClose()
  }

  const handleThemeSelect = (key, e) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedTheme(key)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      {/* Modal Container */}
      <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl shadow-2xl border border-[rgb(var(--border-secondary))] max-w-lg w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="bg-linear-to-r from-green-600/20 to-emerald-600/20 px-6 py-5 border-b border-[rgb(var(--border-secondary))] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sun className="w-6 h-6 text-green-400" />
            <div>
              <h2 className="text-xl font-bold text-gray-200">Theme Settings</h2>
              <p className="text-xs text-gray-400 mt-1">Choose your preferred color theme</p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close theme settings"
            className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-gray-400 hover:text-red-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          
          {/* Theme Grid - 2 columns for Dark and Light */}
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(themes).map(([key, theme]) => {
              const IconComponent = theme.icon
              return (
                <button
                  key={key}
                  onClick={(e) => handleThemeSelect(key, e)}
                  aria-pressed={selectedTheme === key}
                  className={`group relative p-5 rounded-xl border-2 transition-all overflow-hidden ${
                    selectedTheme === key
                      ? 'border-green-500 shadow-lg glow-green bg-[rgb(var(--bg-tertiary))]/50'
                      : 'border-gray-600 hover:border-green-500/50 bg-[rgb(var(--bg-hover))]/20'
                  }`}
                >
                  {/* Background Preview */}
                  <div
                    className="absolute inset-0 rounded-lg opacity-20"
                    style={{ background: theme.bg }}
                  />

                  {/* Content */}
                  <div className="relative z-10 text-center space-y-3">
                    <div className="flex justify-center">
                      <IconComponent className={`w-10 h-10 ${selectedTheme === key ? 'text-green-400' : 'text-gray-400'} transition-colors`} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-200 text-sm">
                        {theme.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-2 leading-snug">
                        {theme.description}
                      </p>
                    </div>
                  </div>

                  {/* Selected Indicator */}
                  {selectedTheme === key && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Preview Section */}
          <div className="pt-4 border-t border-[rgb(var(--border-secondary))]">
            <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Live Preview</p>
            <div
              className="h-20 rounded-lg border-2 border-[rgb(var(--border-secondary))] shadow-lg transition-all"
              style={{ background: themes[selectedTheme].bg }}
            />
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
