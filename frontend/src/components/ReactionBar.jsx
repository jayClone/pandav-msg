import { useEffect, useRef, useState } from 'react'
import { SmilePlus } from 'lucide-react'

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

// Groups {userId, emoji} reactions into pills (emoji + count, highlighted if
// the current user is one of the reactors) plus a hover-revealed "+" button
// that opens a quick-react row. Used under message bubbles in both private
// and group chat — the caller only has to hand it the raw reactions array
// and a toggle callback.
export default function ReactionBar({ reactions = [], currentUserId, onToggle, align = 'start' }) {
  const [showPicker, setShowPicker] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPicker])

  const grouped = reactions.reduce((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || []
    acc[r.emoji].push(r.userId)
    return acc
  }, {})
  const hasReactions = Object.keys(grouped).length > 0

  return (
    <div className={`flex items-center gap-1 flex-wrap ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {Object.entries(grouped).map(([emoji, userIds]) => {
        const mine = userIds.some((id) => String(id) === String(currentUserId))
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            title={mine ? 'Remove your reaction' : 'React'}
            className={`text-xs px-1.5 py-0.5 rounded-full border transition-all flex items-center gap-1 ${
              mine
                ? 'bg-green-500/20 border-green-500/50 text-green-400'
                : 'bg-[rgb(var(--bg-tertiary))] border-[rgb(var(--border-secondary))] text-[rgb(var(--text-muted))] hover:border-green-500/30'
            }`}
          >
            <span>{emoji}</span>
            <span>{userIds.length}</span>
          </button>
        )
      })}

      <div ref={containerRef} className="relative">
        <button
          onClick={() => setShowPicker((v) => !v)}
          title="React"
          aria-label="Add reaction"
          className={`p-1 rounded-full text-[rgb(var(--text-muted))] hover:text-green-400 hover:bg-[rgb(var(--bg-hover))] transition-all ${
            hasReactions ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
        >
          <SmilePlus className="w-3.5 h-3.5" />
        </button>

        {showPicker && (
          <div className="absolute bottom-full mb-1 left-0 flex gap-0.5 bg-[rgb(var(--bg-secondary))] border border-[rgb(var(--border-secondary))] rounded-full shadow-xl p-1 z-40 animate-in fade-in zoom-in duration-100">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onToggle(emoji)
                  setShowPicker(false)
                }}
                className="text-base p-1 rounded-full hover:bg-[rgb(var(--bg-hover))] transition-all hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
