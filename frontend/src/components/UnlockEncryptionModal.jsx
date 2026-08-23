import { useState } from 'react'
import { encodeBase64 } from 'tweetnacl-util'
import cryptoService from '@services/crypto.service'
import authService from '@services/auth.service'
import { Lock, AlertCircle, Loader, LogOut } from 'lucide-react'

// Shown when the app has a valid login session but no E2EE keypair in
// memory — the keypair only ever lives in sessionStorage (tab-scoped), not
// the long-lived localStorage token, so a new tab, browser restart, or
// cleared session storage leaves the account "logged in" but unable to
// decrypt anything. Since the keypair is deterministically derived from the
// password (never stored anywhere), re-entering the password here recovers
// it immediately — no data is lost, nothing needs to be re-sent.
export default function UnlockEncryptionModal({ userId, email, expectedPublicKey, onUnlocked, onLogout }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleUnlock = async (e) => {
    e.preventDefault()
    if (!password) return

    setLoading(true)
    setError('')
    try {
      const keypair = await cryptoService.deriveKeypairFromPassword(email, password)

      if (expectedPublicKey && encodeBase64(keypair.publicKey) !== expectedPublicKey) {
        setError('Incorrect password')
        return
      }

      cryptoService.storeMyKeypair(userId, keypair.publicKey, keypair.secretKey)
      setPassword('')
      onUnlocked()
    } catch (err) {
      setError(err.message || 'Failed to unlock encryption')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await authService.logout()
    onLogout()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-[rgb(var(--bg-secondary))] rounded-2xl shadow-2xl border border-[rgb(var(--border-secondary))] max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="px-6 py-6 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center">
            <Lock className="w-7 h-7 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-[rgb(var(--text-primary))]">Unlock your messages</h2>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Your encryption key isn't loaded in this session. Re-enter your password to unlock your chats — nothing was lost.
          </p>

          <form onSubmit={handleUnlock} className="w-full flex flex-col gap-3 mt-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              autoComplete="current-password"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[rgb(var(--border-secondary))] bg-[rgb(var(--bg-tertiary))] text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-muted))]/70 focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />

            {error && (
              <div role="alert" className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full px-4 py-2.5 rounded-lg bg-linear-to-r from-green-600 to-emerald-700 hover:from-green-500 hover:to-emerald-600 text-white font-semibold text-sm transition-all shadow-lg glow-green flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Unlock
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-4 py-2 rounded-lg text-[rgb(var(--text-muted))] hover:text-red-400 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log out instead
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
