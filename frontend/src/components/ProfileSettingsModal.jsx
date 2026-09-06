import { useEffect, useRef, useState } from 'react'
import { X, Camera, Trash2, Loader, AlertCircle } from 'lucide-react'
import Avatar from './Avatar'
import userAPI from '@api/user.api.js'
import { compressImageFile } from '@utils/imageCompression.js'

export default function ProfileSettingsModal({ isOpen, onClose, currentUserName, avatar, onAvatarChange }) {
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Close on Escape, matching FriendRequestModal.jsx's existing pattern —
  // every other modal in this app supports it, this one just never had it.
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    setError('')
    setLoading(true)
    try {
      const { dataUrl } = await compressImageFile(file, { maxDimension: 512, quality: 0.8 })
      const response = await userAPI.updateAvatar(dataUrl)
      if (response.data.success) {
        onAvatarChange(response.data.data.avatar)
      } else {
        setError(response.data.message || 'Failed to update avatar')
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update avatar')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    setError('')
    setLoading(true)
    try {
      const response = await userAPI.removeAvatar()
      if (response.data.success) {
        onAvatarChange(null)
      } else {
        setError(response.data.message || 'Failed to remove avatar')
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to remove avatar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl shadow-2xl border border-[rgb(var(--border-secondary))] max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="px-6 py-5 border-b border-[rgb(var(--border-secondary))] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[rgb(var(--text-primary))]">Profile Picture</h2>
          <button
            onClick={onClose}
            title="Close"
            aria-label="Close profile settings"
            className="p-2 hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-all text-[rgb(var(--text-muted))] hover:text-red-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center gap-4">
          <Avatar src={avatar} name={currentUserName} size="lg" />

          {error && (
            <div role="alert" className="w-full bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
          />

          <div className="flex gap-2 w-full">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-linear-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white font-semibold text-sm transition-all shadow-lg glow-green flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {avatar ? 'Change photo' : 'Upload photo'}
            </button>

            {avatar && (
              <button
                onClick={handleRemove}
                disabled={loading}
                title="Remove photo"
                aria-label="Remove profile photo"
                className="px-4 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
