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
      }, 5000);
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

    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    console.log('🔌 Connecting to:', socketUrl);

    // ✅ CRITICAL FIX FOR MOBILE DATA
    socket = io(socketUrl, {
        auth: {
            token: token
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 10,  // ✅ INCREASED from 5 to 10
        
        // ✅ TRANSPORTS PRIORITY: Try polling FIRST on mobile
        transports: [
            'polling',      // ✅ PUT POLLING FIRST on mobile
            'websocket'     // Fallback to websocket
        ],
        
        // ✅ POLLING CONFIGURATION (for mobile data)
        upgrade: true,
        rememberUpgrade: true,
        
        // ✅ CONNECTION TIMEOUT
        connectTimeout: 30000,  // ✅ INCREASED from default
        
        // ✅ SECURE ONLY IN PRODUCTION
        secure: import.meta.env.PROD,
        rejectUnauthorized: false,
        
        // ✅ MOBILE-FRIENDLY SETTINGS
        closeOnBeforeunload: false,  // Keep alive when switching tabs
        forceBase64: false,  // Better performance on mobile
        
        // ✅ POLLING INTERVAL (adjust based on battery)
        // Decrease interval = faster but more battery drain
        // Default is 100ms
    });

    socket.on('connect', () => {
        console.log('🟢 Socket connected:', socket.id);
        console.log('🔗 Transport:', socket.io.engine.transport.name);  // ✅ Log which transport
    });

    socket.on('connect_error', (error) => {
        console.error('🔴 Socket connection error:', {
            message: error.message,
            type: error.type,
            url: socketUrl
        });
        
        if (error.message === 'websocket error') {
            console.warn('⚠️ WebSocket blocked - switching to polling');
        }
    });

    // ✅ NEW: Log transport changes
    socket.io.engine.on('upgrade', (transport) => {
        console.log('📡 [SOCKET UPGRADE] Upgraded to:', transport.name);
    });

    socket.io.engine.on('downgrade', (transport) => {
        console.warn('📉 [SOCKET DOWNGRADE] Downgraded to:', transport.name);
    });

    socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
        
        // ✅ Handle different disconnect reasons
        if (reason === 'io server disconnect') {
            console.log('🔄 Server disconnected - attempting reconnect');
            setTimeout(() => socket.connect(), 1000);
        }
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