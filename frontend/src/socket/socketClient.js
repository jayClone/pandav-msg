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

    // ✅ FIX: Use proper socket URL for both local and production
    let socketUrl = 'http://localhost:5000';  // Default for local dev
    
    // ✅ In production (deployed on Vercel), use Railway backend
    if (import.meta.env.PROD) {
        socketUrl = 'https://pandav-msg.up.railway.app';
    } else if (import.meta.env.VITE_API_URL) {
        // Use env variable if provided (for docker-compose, etc)
        socketUrl = import.meta.env.VITE_API_URL;
    }
    
    console.log('🔌 Connecting to:', socketUrl);
    console.log('   Environment:', import.meta.env.MODE);
    console.log('   PROD:', import.meta.env.PROD);

    socket = io(socketUrl, {
        auth: {
            token: token
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 15,  // ✅ INCREASED for mobile
        
        // ✅ CRITICAL: Polling FIRST for mobile data
        transports: ['polling', 'websocket'],
        
        upgrade: true,
        rememberUpgrade: true,
        
        connectTimeout: 30000,
        
        // ✅ HTTPS only in production
        secure: import.meta.env.PROD,
        rejectUnauthorized: false,
        
        // ✅ Mobile-friendly
        closeOnBeforeunload: false,
        forceBase64: false,
        
        // ✅ Polling config for mobile
        withCredentials: true,
    });

    socket.on('connect', () => {
        console.log('🟢 Socket connected:', socket.id);
        const transport = socket?.conn?.transport?.name || 'unknown';
        console.log('🔗 Transport:', transport);
    });

    socket.on('connect_error', (error) => {
        console.error('🔴 Socket connection error:', {
            message: error.message,
            type: error.type,
            url: socketUrl,
            environment: import.meta.env.MODE
        });
        
        if (error.message === 'websocket error') {
            console.warn('⚠️ WebSocket blocked - polling will be used');
        }
    });

    socket.io.engine?.on('upgrade', (transport) => {
        console.log('📡 [SOCKET UPGRADE]:', transport.name);
    });

    socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected:', reason);
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