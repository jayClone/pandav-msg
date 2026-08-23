import { useEffect, useRef, useState } from 'react'

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    icon: '😀',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠'],
  },
  {
    name: 'Gestures',
    icon: '👍',
    emojis: ['👍', '👎', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🙏', '✍️', '💪'],
  },
  {
    name: 'Hearts',
    icon: '❤️',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'],
  },
  {
    name: 'Animals',
    icon: '🐶',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜'],
  },
  {
    name: 'Food',
    icon: '🍕',
    emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🍿', '🥚', '🍳', '🥞', '🧇', '🍰', '🎂', '🍩', '🍪', '🍫', '🍬', '🍭', '🍯', '☕', '🍵', '🥤', '🍺', '🍻', '🥂', '🍷'],
  },
  {
    name: 'Objects',
    icon: '🎉',
    emojis: ['🎉', '🎊', '🎁', '🎈', '🔥', '✨', '⭐', '🌟', '💯', '✅', '❌', '💤', '💬', '👀', '🎵', '🎶', '📌', '📎', '🔔', '🔒', '🔓', '💡', '⚡', '🌈', '☀️', '🌙', '☁️', '⛄', '🎄', '🕐', '📷', '🎮'],
  },
]

export default function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState(0)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Emoji picker"
      className="absolute bottom-full mb-2 left-0 w-72 sm:w-80 bg-[rgb(var(--bg-secondary))] border border-[rgb(var(--border-secondary))] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div className="flex border-b border-[rgb(var(--border-secondary))]">
        {EMOJI_CATEGORIES.map((cat, index) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(index)}
            title={cat.name}
            aria-label={cat.name}
            aria-pressed={activeCategory === index}
            className={`flex-1 py-2 text-lg transition-all ${
              activeCategory === index
                ? 'bg-green-500/10 border-b-2 border-green-500'
                : 'hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            {cat.icon}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 sm:grid-cols-8 gap-1 p-2 max-h-56 overflow-y-auto custom-scrollbar">
        {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            onClick={() => onSelect(emoji)}
            className="text-xl p-1.5 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-all"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
