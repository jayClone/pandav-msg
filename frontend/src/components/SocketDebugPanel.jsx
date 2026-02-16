import { useState, useEffect } from 'react'
import { X, RefreshCw, Wifi, WifiOff, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DiagnosticItem = ({ label, value }) => (
  <div className="flex items-center justify-between text-xs py-1">
    <span>{label}</span>
    <span className={value ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
      {value ? '✅' : '❌'}
    </span>
  </div>
)

export function SocketDebugPanel({ socket }) {
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState([])
  const [expandedSections, setExpandedSections] = useState({
    status: true,
    errors: true,
    logs: true,
    diagnostics: false
  })
  const [status, setStatus] = useState({
    connected: false,
    transport: 'unknown',
    socketId: null,
    url: null,
    errors: [],
    diagnostics: {
      tokenValid: false,
      corsOk: false,
      backendReachable: false,
      pollingWorks: false,
      websocketWorks: false,
      authPassed: false
    }
  })

  useEffect(() => {
    if (!socket) return

    const addLog = (message, type = 'info', diagnostic = null) => {
      setLogs(prev => [
        {
          id: Date.now(),
          message,
          type,
          timestamp: new Date().toLocaleTimeString(),
          diagnostic
        },
        ...prev
      ].slice(0, 100))
    }

    // ✅ CHECK 1: Token validation
    const token = localStorage.getItem('token')
    if (token) {
      try {
        const parts = token.split('.')
        if (parts.length === 3) {
          setStatus(prev => ({
            ...prev,
            diagnostics: { ...prev.diagnostics, tokenValid: true }
          }))
          addLog('✅ Token format valid (JWT)', 'success', 'tokenValid')
        } else {
          addLog('❌ Token format invalid (not JWT)', 'error', 'tokenValid')
        }
      } catch (e) {
        addLog(`❌ Token parsing error: ${e.message}`, 'error', 'tokenValid')
      }
    } else {
      addLog('❌ No token in localStorage', 'error', 'tokenValid')
    }

    // ✅ CHECK 2: Backend reachability (via fetch)
    const checkBackendReachability = async () => {
      try {
        const backendUrl = window.location.hostname !== 'localhost' 
          ? 'https://pandav-msg.up.railway.app' 
          : 'http://localhost:5000'
        
        const response = await fetch(`${backendUrl}/api/v1/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (response.ok) {
          setStatus(prev => ({
            ...prev,
            diagnostics: { ...prev.diagnostics, backendReachable: true }
          }))
          addLog(`✅ Backend reachable (${backendUrl})`, 'success', 'backendReachable')
        } else {
          addLog(`❌ Backend returned ${response.status}`, 'error', 'backendReachable')
        }
      } catch (error) {
        addLog(`❌ Backend unreachable: ${error.message}`, 'error', 'backendReachable')
      }
    }
    
    checkBackendReachability()

    // ✅ Connection success
    socket.on('connect', () => {
      const transport = socket?.io?.engine?.transport?.name || 'unknown'
      
      setStatus(prev => ({
        ...prev,
        connected: true,
        socketId: socket.id,
        transport: transport,
        diagnostics: { 
          ...prev.diagnostics, 
          authPassed: true,
          [transport === 'polling' ? 'pollingWorks' : 'websocketWorks']: true
        }
      }))
      
      addLog(`✅ Socket Connected`, 'success')
      addLog(`   ID: ${socket.id}`, 'success')
      addLog(`   Transport: ${transport}`, 'success')
      
      if (transport === 'polling') {
        addLog('📱 Using HTTP Long-Polling (Mobile Mode)', 'success', 'pollingWorks')
      } else if (transport === 'websocket') {
        addLog('⚡ Using WebSocket (Fast Mode)', 'success', 'websocketWorks')
      }
    })

    // ✅ Detailed connection error with diagnostics
    socket.on('connect_error', (error) => {
      console.error('[DEBUG PANEL CATCH] Connect Error:', error)
      
      addLog(`❌ Connection Error: ${error.message}`, 'error')
      
      // ✅ Detailed error analysis
      if (error.message?.includes('AUTH') || error.message?.includes('403') || error.message?.includes('401')) {
        addLog(`🔐 Authentication Failed`, 'error')
        addLog(`   Check: Is token valid?`, 'error')
        addLog(`   Check: Is token expired?`, 'error')
        setStatus(prev => ({
          ...prev,
          diagnostics: { ...prev.diagnostics, authPassed: false }
        }))
      } 
      else if (error.message?.includes('poll') || error.message?.includes('xhr')) {
        addLog(`📡 XHR Polling Error Detected`, 'error')
        addLog(`   This means backend rejected polling request`, 'error')
        addLog(`   Possible causes:`, 'error')
        addLog(`   1. CORS not allowing this origin`, 'error')
        addLog(`   2. Backend socket transports missing 'polling'`, 'error')
        addLog(`   3. Socket.IO path is wrong (/socket.io/ expected)`, 'error')
        addLog(`   4. Method not allowed (GET/POST needed)`, 'error')
        setStatus(prev => ({
          ...prev,
          diagnostics: { ...prev.diagnostics, pollingWorks: false }
        }))
      }
      else if (error.message?.includes('CORS') || error.message?.includes('405')) {
        addLog(`🚫 CORS or Method Error`, 'error')
        addLog(`   Backend blocking this request`, 'error')
        setStatus(prev => ({
          ...prev,
          diagnostics: { ...prev.diagnostics, corsOk: false }
        }))
      }
      else if (error.message?.includes('econnrefused') || error.message?.includes('refused')) {
        addLog(`🔌 Connection Refused`, 'error')
        addLog(`   Backend not running or unreachable`, 'error')
        setStatus(prev => ({
          ...prev,
          diagnostics: { ...prev.diagnostics, backendReachable: false }
        }))
      }
      else if (error.message?.includes('timeout')) {
        addLog(`⏱️ Connection Timeout`, 'error')
        addLog(`   Backend too slow or network latency`, 'error')
      }
      else {
        addLog(`❓ Unknown Error: ${error.type}`, 'error')
        addLog(`   Data: ${JSON.stringify(error.data)}`, 'error')
      }
      
      setStatus(prev => ({
        ...prev,
        connected: false,
        errors: [...prev.errors, {
          message: error.message,
          type: error.type,
          time: new Date().toLocaleTimeString()
        }].slice(-10)
      }))
    })

    // ✅ XHR/Engine specific errors
    socket.io?.engine?.on('error', (error) => {
      console.error('[DEBUG PANEL] Engine Error:', error)
      addLog(`⚠️ Engine Error: ${error?.message || error}`, 'error')
      
      if (error?.message?.includes('poll')) {
        addLog(`📡 Polling failed - retrying...`, 'warning')
      }
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
      addLog(`🔄 Reconnect Attempt #${attemptNumber}...`, 'warning')
    })

    socket.on('reconnect_failed', () => {
      addLog(`❌ Reconnection Failed`, 'error')
    })

    // ✅ Transport events
    socket.io?.engine?.on('upgrade', (transport) => {
      addLog(`📡 Transport upgraded to: ${transport.name}`, 'success')
    })

    socket.io?.engine?.on('downgrade', (transport) => {
      addLog(`📉 Transport downgraded to: ${transport.name}`, 'warning')
    })

    // ✅ Socket events
    socket.on('message_received', (data) => {
      addLog(`📨 Message: ${data.text?.substring(0, 30)}...`, 'info')
    })

    socket.on('user_online', (data) => {
      addLog(`🟢 User Online: ${data.userId}`, 'info')
    })

    socket.on('user_offline', (data) => {
      addLog(`🔴 User Offline: ${data.userId}`, 'info')
    })

    socket.on('typing', (data) => {
      addLog(`⌨️ Typing: ${data.userId}`, 'info')
    })

    return () => {
      socket.off('connect')
      socket.off('connect_error')
      socket.off('disconnect')
      socket.off('reconnect_attempt')
      socket.off('reconnect_failed')
      socket.io?.engine?.off('error')
      socket.io?.engine?.off('upgrade')
      socket.io?.engine?.off('downgrade')
      socket.off('message_received')
      socket.off('user_online')
      socket.off('user_offline')
      socket.off('typing')
    }
  }, [socket])

  if (!socket) {
    return null
  }

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 z-40 p-3 rounded-full shadow-lg transition-colors ${
          status.connected 
            ? 'bg-green-600 hover:bg-green-700 text-white' 
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
        title={status.connected ? 'Socket Connected' : 'Socket Disconnected'}
      >
        {status.connected ? (
          <Wifi className="h-6 w-6 animate-pulse" />
        ) : (
          <WifiOff className="h-6 w-6" />
        )}
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-96 max-h-screen bg-slate-900 text-white rounded-lg shadow-2xl border-2 border-blue-500 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-blue-600 px-4 py-3 flex items-center justify-between sticky top-0">
            <h3 className="font-bold text-sm">🔧 Socket Diagnostics</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-blue-700 p-1 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Status Section */}
            <div className="border-b border-slate-700">
              <button
                onClick={() => toggleSection('status')}
                className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 flex items-center justify-between"
              >
                <span className="text-xs font-bold">📊 Status</span>
                {expandedSections.status ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expandedSections.status && (
                <div className="px-4 py-3 space-y-2 text-xs">
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
                  
                  <div className="font-mono text-xs bg-slate-800 p-2 rounded break-all">
                    <p className="text-yellow-400">Socket ID:</p>
                    <p className="text-green-300">{status.socketId || 'N/A'}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-cyan-400" />
                    <span>Transport: <span className="font-bold text-cyan-300">{status.transport}</span></span>
                  </div>
                </div>
              )}
            </div>

            {/* Diagnostics Section */}
            <div className="border-b border-slate-700">
              <button
                onClick={() => toggleSection('diagnostics')}
                className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 flex items-center justify-between"
              >
                <span className="text-xs font-bold">🔍 Diagnostics</span>
                {expandedSections.diagnostics ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expandedSections.diagnostics && (
                <div className="px-4 py-3 space-y-1 text-xs border-t border-slate-700">
                  <DiagnosticItem label="Token Valid" value={status.diagnostics.tokenValid} />
                  <DiagnosticItem label="Backend Reachable" value={status.diagnostics.backendReachable} />
                  <DiagnosticItem label="Auth Passed" value={status.diagnostics.authPassed} />
                  <DiagnosticItem label="Polling Works" value={status.diagnostics.pollingWorks} />
                  <DiagnosticItem label="WebSocket Works" value={status.diagnostics.websocketWorks} />
                  <DiagnosticItem label="CORS OK" value={status.diagnostics.corsOk} />
                </div>
              )}
            </div>

            {/* Errors Section */}
            {status.errors.length > 0 && (
              <div className="border-b border-slate-700">
                <button
                  onClick={() => toggleSection('errors')}
                  className="w-full px-4 py-2 bg-red-900/30 hover:bg-red-900/50 flex items-center justify-between border-l-4 border-red-600"
                >
                  <span className="text-xs font-bold">⚠️ Errors ({status.errors.length})</span>
                  {expandedSections.errors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {expandedSections.errors && (
                  <div className="px-4 py-3 space-y-2 text-xs border-t border-red-700">
                    {status.errors.map((err, idx) => (
                      <div key={idx} className="bg-red-900/20 p-2 rounded border border-red-700">
                        <p className="text-red-200 font-bold">[{err.time}]</p>
                        <p className="text-red-300">{err.message}</p>
                        {err.type && <p className="text-red-400 text-xs">Type: {err.type}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Logs Section */}
            <div className="border-b border-slate-700">
              <button
                onClick={() => toggleSection('logs')}
                className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 flex items-center justify-between"
              >
                <span className="text-xs font-bold">📋 Logs ({logs.length})</span>
                {expandedSections.logs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expandedSections.logs && (
                <div className="p-3 space-y-1 max-h-64 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-slate-500 text-xs">No logs yet...</p>
                  ) : (
                    logs.map(log => (
                      <div
                        key={log.id}
                        className={`text-xs font-mono p-1 rounded border-l-2 ${
                          log.type === 'success'
                            ? 'bg-green-900/20 border-green-600 text-green-300'
                            : log.type === 'error'
                            ? 'bg-red-900/20 border-red-600 text-red-300'
                            : log.type === 'warning'
                            ? 'bg-yellow-900/20 border-yellow-600 text-yellow-300'
                            : 'bg-blue-900/20 border-blue-600 text-blue-300'
                        }`}
                        title={log.message}
                      >
                        <div className="flex justify-between">
                          <span>{log.message}</span>
                          <span className="text-slate-400 text-xs">{log.timestamp}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-800 px-4 py-2 border-t border-slate-700 flex gap-2 sticky bottom-0">
            <Button
              size="sm"
              className="text-xs flex-1"
              onClick={() => setLogs([])}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs flex-1"
              onClick={() => {
                if (socket) {
                  socket.connected ? socket.disconnect() : socket.connect()
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