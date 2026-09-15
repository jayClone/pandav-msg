import { useEffect, useRef } from 'react'

// Shared destructive/important-action confirmation, replacing the mix of
// plain window.confirm() (a jarring native browser dialog inside an APK)
// and one hand-rolled modal that only this component used to have. Keeps
// the accessibility behavior (auto-focus Cancel, trap Tab, Escape closes)
// that the "Delete Group?" dialog was specifically fixed to have.
export default function ConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  loading = false,
  loadingLabel,
  danger = false,
  dialogLabel,
}) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const container = containerRef.current
    const focusable = container?.querySelectorAll('button:not(:disabled)') || []
    focusable[0]?.focus()

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel()
        return
      }
      if (e.key !== 'Tab' || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={onCancel}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel || title}
        onClick={(e) => e.stopPropagation()}
        className="bg-[rgb(var(--bg-secondary))] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[rgb(var(--border-secondary))] sm:max-w-sm w-full overflow-hidden animate-in fade-in slide-in-from-bottom sm:zoom-in sm:slide-in-from-bottom-0 duration-300 safe-pbottom"
      >
        <div className="p-6">
          <h3 className={`text-lg font-bold mb-2 ${danger ? 'text-red-400' : 'text-[rgb(var(--text-primary))]'}`}>
            {title}
          </h3>
          <p className="text-sm text-[rgb(var(--text-muted))] mb-5">
            {message}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[rgb(var(--bg-tertiary))] hover:bg-[rgb(var(--bg-hover))] active:bg-[rgb(var(--bg-hover))] text-[rgb(var(--text-primary))] text-sm font-medium transition-colors disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                danger
                  ? 'bg-red-600 hover:bg-red-700 active:bg-red-700 text-white'
                  : 'bg-linear-to-br from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white glow-green'
              }`}
            >
              {loading ? (loadingLabel || confirmLabel) : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
