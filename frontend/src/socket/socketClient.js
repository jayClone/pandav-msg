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
      }, 10000);  // ✅ INCREASED to 10s for mobile
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

    // ✅ CRITICAL FIX: Proper URL detection
    let socketUrl = 'http://localhost:5000';
    
    console.log('🔍 [ENVIRONMENT]');
    console.log('   MODE:', import.meta.env.MODE);
    console.log('   PROD:', import.meta.env.PROD);
    console.log('   VITE_API_URL:', import.meta.env.VITE_API_URL);

    // ✅ Production deployment
    if (import.meta.env.PROD) {
        socketUrl = import.meta.env.VITE_API_URL || 'https://pandav-msg.up.railway.app';
    } 
    // ✅ Development with env var (docker-compose, etc)
    else if (import.meta.env.VITE_API_URL) {
        socketUrl = import.meta.env.VITE_API_URL;
    }
    
    console.log('🔌 [SOCKET] Connecting to:', socketUrl);

    // ✅ MOBILE-OPTIMIZED SOCKET.IO CONFIG
    socket = io(socketUrl, {
        auth: {
            token: token
        },
        
        // ✅ CRITICAL: Polling FIRST, WebSocket second
        transports: ['polling', 'websocket'],
        
        // ✅ Reconnection settings (mobile needs more retries)
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15000,  // ✅ INCREASED for mobile
        reconnectionAttempts: 20,      // ✅ INCREASED for mobile
        
        // ✅ Connection timeout
        connectTimeout: 45000,  // ✅ INCREASED - mobile is slow
        
        // ✅ Polling settings (for when websocket fails)
        upgrade: true,
        rememberUpgrade: true,
        
        // ✅ Protocol settings
        secure: import.meta.env.PROD,
        rejectUnauthorized: false,
        
        // ✅ Mobile-friendly
        closeOnBeforeunload: false,
        forceBase64: false,
        
        // ✅ Buffer settings
        maxHttpBufferSize: 1e6,
        
        // ✅ Credentials (important for CORS on mobile)
        withCredentials: true,
    });

    // ✅ CONNECTION SUCCESS
    socket.on('connect', () => {
        console.log('✅✅✅ SOCKET CONNECTED ✅✅✅');
        console.log('   Socket ID:', socket.id);
        
        // ✅ Log which transport is being used
        const transport = socket?.io?.engine?.transport?.name || 'unknown';
        console.log('   Transport:', transport);
        console.log('   Connected:', socket.connected);
        
        if (transport === 'polling') {
            console.log('📱 [MOBILE] Using HTTP Long-Polling (mobile data detected)');
        } else if (transport === 'websocket') {
            console.log('⚡ [WIFI] Using WebSocket (low latency)');
        }
    });

    // ✅ CONNECTION ERRORS
    socket.on('connect_error', (error) => {
        console.error('🔴🔴🔴 SOCKET ERROR 🔴🔴🔴');
        console.error('   Message:', error.message);
        console.error('   Type:', error.type);
        console.error('   Data:', error.data);
        console.error('   URL:', socketUrl);
        console.error('   Environment:', import.meta.env.MODE);
        
        // ✅ Specific error handling
        if (error.message.includes('AUTH_ERROR')) {
            console.error('❌ Authentication failed - invalid or expired token');
        }
        
        if (error.message === 'websocket error') {
            console.warn('⚠️ WebSocket failed - polling will be used as fallback');
        }
        
        if (error.message.includes('CORS')) {
            console.error('❌ CORS error - check backend CORS configuration');
        }
    });

    // ✅ TRANSPORT EVENTS
    socket.io?.engine?.on('upgrade', (transport) => {
        console.log('📡 [UPGRADE] Connection upgraded to:', transport.name);
    });

    socket.io?.engine?.on('downgrade', (transport) => {
        console.warn('📉 [DOWNGRADE] Connection downgraded to:', transport.name);
    });

    // ✅ DISCONNECT HANDLING
    socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected');
        console.log('   Reason:', reason);
        
        if (reason === 'io server disconnect') {
            console.log('🔄 Server disconnected - reconnecting...');
            setTimeout(() => {
                if (socket) socket.connect();
            }, 3000);
        }
    });

    // ✅ RECONNECT ATTEMPTS
    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt #${attemptNumber}`);
    });

    socket.on('reconnect_failed', () => {
        console.error('❌ Reconnection failed - giving up');
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