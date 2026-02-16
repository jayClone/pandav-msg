import io from 'socket.io-client';

let socket = null;

export const isSocketConnected = () => {
    return socket?.connected ?? false;
};

export const waitForSocket = () => {
  return new Promise((resolve, reject) => {
    if (socket?.connected) {
      resolve(socket);
      return;
    }
    
    if (socket) {
      const checkConnection = setInterval(() => {
        if (socket?.connected) {
          clearInterval(checkConnection);
          resolve(socket);
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkConnection);
        reject(new Error('Socket connection timeout'));
      }, 15000);  // ✅ INCREASED to 15s
    } else {
      reject(new Error('Socket not initialized'));
    }
  });
};

export const connectSocket = (token) => {
    if (socket) {
        console.log('🔄 Disconnecting old socket...');
        socket.disconnect();
        socket = null;
    }

    // ✅ FIX: PROPER URL DETECTION FOR ALL ENVIRONMENTS
    let socketUrl = 'http://localhost:5000';  // Default for local
    
    console.log('🔍 [SOCKET-URL-DETECTION]');
    console.log('   Current URL:', window.location.origin);
    console.log('   Import.meta.env.MODE:', import.meta.env.MODE);
    console.log('   Import.meta.env.PROD:', import.meta.env.PROD);

    // ✅ DETECT ENVIRONMENT BY ACTUAL PAGE URL
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        // ✅ Running on production domain (Vercel, Railway, etc)
        console.log('🌐 [PRODUCTION] Using Railway backend');
        socketUrl = 'https://pandav-msg.up.railway.app';
    } 
    else if (import.meta.env.VITE_API_URL) {
        // ✅ Docker-compose or custom env
        console.log('🐳 [DOCKER] Using VITE_API_URL:', import.meta.env.VITE_API_URL);
        socketUrl = import.meta.env.VITE_API_URL;
    }
    // else: use default localhost
    
    console.log('🔌 [SOCKET] Connecting to:', socketUrl);
    console.log('   Transport: polling (primary) + websocket (fallback)');

    socket = io(socketUrl, {
        auth: {
            token: token
        },
        
        // ✅ CRITICAL: Polling FIRST (works on mobile data)
        transports: ['polling', 'websocket'],
        
        // ✅ Reconnection for mobile (unstable connection)
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 20000,  // ✅ INCREASED
        reconnectionAttempts: 30,      // ✅ INCREASED - keep trying
        
        // ✅ Long timeouts for mobile
        connectTimeout: 60000,  // ✅ 60 SECONDS for mobile data
        
        // ✅ Polling config
        upgrade: true,
        rememberUpgrade: true,
        
        // ✅ Protocol
        secure: window.location.protocol === 'https:',  // ✅ AUTO-DETECT HTTPS
        rejectUnauthorized: false,
        
        // ✅ Mobile-friendly
        closeOnBeforeunload: false,
        forceBase64: false,
        
        // ✅ Polling interval (how often to ask server for updates)
        // Default 100ms - we'll keep it for fast updates
        
        // ✅ CRITICAL: Enable credentials for cross-origin
        withCredentials: true,
    });

    // ✅ CONNECTION SUCCESS
    socket.on('connect', () => {
        console.log('✅✅✅ SOCKET CONNECTED ✅✅✅');
        console.log('   Socket ID:', socket.id);
        console.log('   URL:', socketUrl);
        
        const transport = socket?.io?.engine?.transport?.name || 'unknown';
        console.log('   Transport Used:', transport);
        console.log('   Connected Status:', socket.connected);
        
        if (transport === 'polling') {
            console.log('📱 [MOBILE] Using HTTP Long-Polling');
        } else if (transport === 'websocket') {
            console.log('⚡ [FAST] Using WebSocket');
        }
    });

    // ✅ CONNECTION ERROR - DETAILED LOGGING
    socket.on('connect_error', (error) => {
        console.error('\n🔴🔴🔴 SOCKET CONNECTION ERROR 🔴🔴🔴');
        console.error('Error Message:', error.message);
        console.error('Error Type:', error.type);
        console.error('Error Data:', error.data);
        console.error('Connecting to URL:', socketUrl);
        console.error('Current Page:', window.location.href);
        console.error('Environment:', import.meta.env.MODE);
        
        // ✅ Specific error diagnostics
        if (error.message?.includes('AUTH')) {
            console.error('❌ Authentication failed - check token');
        }
        if (error.message?.includes('CORS')) {
            console.error('❌ CORS error - backend not allowing this origin');
        }
        if (error.message?.includes('timeout')) {
            console.error('❌ Connection timeout - backend unreachable or very slow');
        }
        if (error.message?.includes('econnrefused')) {
            console.error('❌ Connection refused - backend not running');
        }
        console.error('🔴🔴🔴\n');
    });

    // ✅ TRANSPORT UPGRADE/DOWNGRADE
    socket.io?.engine?.on('upgrade', (transport) => {
        console.log('📡 [UPGRADE] Transport upgraded to:', transport.name);
    });

    socket.io?.engine?.on('downgrade', (transport) => {
        console.warn('📉 [DOWNGRADE] Transport downgraded to:', transport.name);
    });

    // ✅ DISCONNECT
    socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected');
        console.log('   Reason:', reason);
        
        if (reason === 'io server disconnect') {
            console.log('🔄 Server disconnected, attempting reconnect...');
            setTimeout(() => {
                if (socket) socket.connect();
            }, 3000);
        }
    });

    // ✅ RECONNECTION TRACKING
    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt #${attemptNumber}...`);
    });

    socket.on('reconnect_failed', () => {
        console.error('❌ Reconnection permanently failed');
        console.error('   Check if backend is running and accessible');
    });

    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
        console.log('✅ Socket disconnected');
    }
};

export const getSocket = () => {
    return socket;
};