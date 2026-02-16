import { useState, useEffect } from 'react'
import { X, RefreshCw, Wifi, WifiOff, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SocketDebugPanel({ socket }) {
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState([])
  const [status, setStatus] = useState({
    connected: false,
    transport: 'unknown',
    socketId: null,
    url: null,
    errors: []
  })

  useEffect(() => {
    if (!socket) return

    const addLog = (message, type = 'info') => {
      setLogs(prev => [
        {
          id: Date.now(),
          message,
          type,
          timestamp: new Date().toLocaleTimeString()
        },
        ...prev
      ].slice(0, 50)) // Keep last 50 logs
    }

    // ✅ Connection events
    socket.on('connect', () => {
      const transport = socket?.io?.engine?.transport?.name || 'unknown'
      setStatus(prev => ({
        ...prev,
        connected: true,
        socketId: socket.id,
        transport: transport
      }))
      addLog(`✅ Connected | Transport: ${transport}`, 'success')
    })

    socket.on('connect_error', (error) => {
      addLog(`❌ Connection Error: ${error.message}`, 'error')
      setStatus(prev => ({
        ...prev,
        connected: false,
        errors: [...prev.errors, {
          message: error.message,
          time: new Date().toLocaleTimeString()
        }].slice(-5)
      }))
    })

    socket.on('disconnect', (reason) => {
      setStatus(prev => ({
        ...prev,
        connected: false,
        transport: 'disconnected'
      }))
      addLog(`🔌 Disconnected | Reason: ${reason}`, 'warning')
    })

    socket.on('reconnect_attempt', (attemptNumber) => {
      addLog(`🔄 Reconnect Attempt #${attemptNumber}`, 'warning')
    })

    // ✅ Message events
    socket.on('message_received', (data) => {
      addLog(`📨 Message Received: ${data.text?.substring(0, 30)}...`, 'info')
    })

    socket.on('user_online', (data) => {
      addLog(`🟢 User Online: ${data.userId}`, 'info')
    })

    socket.on('user_offline', (data) => {
      addLog(`🔴 User Offline: ${data.userId}`, 'info')
    })

    socket.on('typing', (data) => {
      addLog(`⌨️ User Typing: ${data.userId}`, 'info')
    })

    return () => {
      socket.off('connect')
      socket.off('connect_error')
      socket.off('disconnect')
      socket.off('reconnect_attempt')
      socket.off('message_received')
      socket.off('user_online')
      socket.off('user_offline')
      socket.off('typing')
    }
  }, [socket])

  if (!socket) {
    return null
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-40 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="Socket Debug Panel"
      >
        {status.connected ? (
          <Wifi className="h-6 w-6" />
        ) : (
          <WifiOff className="h-6 w-6" />
        )}
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-96 max-h-96 bg-slate-900 text-white rounded-lg shadow-2xl border border-blue-500 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
            <h3 className="font-bold text-sm">🔧 Socket Debug Panel</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-blue-700 p-1 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Status Section */}
          <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
            <div className="space-y-2 text-xs">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {status.connected ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-400" />
                )}
                <span>
                  Status: <span className={status.connected ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                    {status.connected ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </span>
              </div>

              {/* Socket ID */}
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-yellow-400 mt-0.5" />
                <div>
                  <p>Socket ID:</p>
                  <p className="font-mono text-xs text-green-300 break-all">
                    {status.socketId || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Transport */}
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-cyan-400" />
                <span>
                  Transport: <span className="font-bold text-cyan-300">
                    {status.transport}
                  </span>
                </span>
              </div>

              {/* Recent Errors */}
              {status.errors.length > 0 && (
                <div className="mt-2 p-2 bg-red-900/30 rounded border border-red-700">
                  <p className="text-red-300 font-bold text-xs mb-1">Recent Errors:</p>
                  {status.errors.map((err, idx) => (
                    <p key={idx} className="text-red-200 text-xs">
                      [{err.time}] {err.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Logs Section */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-900">
            {logs.length === 0 ? (
              <p className="text-slate-500 text-xs">No logs yet...</p>
            ) : (
              logs.map(log => (
                <div
                  key={log.id}
                  className={`text-xs font-mono p-2 rounded border-l-2 ${
                    log.type === 'success'
                      ? 'bg-green-900/20 border-green-600 text-green-300'
                      : log.type === 'error'
                      ? 'bg-red-900/20 border-red-600 text-red-300'
                      : log.type === 'warning'
                      ? 'bg-yellow-900/20 border-yellow-600 text-yellow-300'
                      : 'bg-blue-900/20 border-blue-600 text-blue-300'
                  }`}
                >
                  <div className="flex justify-between mb-1">
                    <span>{log.message}</span>
                    <span className="text-slate-500">{log.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-800 px-4 py-2 border-t border-slate-700 flex gap-2">
            <Button
              size="sm"
              className="text-xs"
              onClick={() => {
                setLogs([])
              }}
            >
              Clear Logs
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                if (socket) {
                  if (socket.connected) {
                    socket.disconnect()
                  } else {
                    socket.connect()
                  }
                }
              }}
            >
              {socket.connected ? 'Disconnect' : 'Reconnect'}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}