import io from 'socket.io-client';

let socket = null;

// Helper to check if socket is connected
export const isSocketConnected = () => {
    return socket?.connected ?? false;
};

// Helper to wait for socket to be ready
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
      
      // Timeout after 5 seconds
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
    // Disconnect old socket if exists
    if (socket) {
        console.log('🔄 Disconnecting old socket...');
        socket.disconnect();
        socket = null;
    }

    socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
        auth: {
            token: token
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        reconnectionAttempts: 5,  // ✅ REDUCED from 10
        transports: ['websocket', 'polling'],
        secure: true,  // ✅ HTTPS in production
        rejectUnauthorized: false  // ✅ ADD: For development
    });

    socket.on('connect', () => {
        console.log('🟢 Socket connected:', socket.id);
    });

    socket.on('connect_error', (error) => {
        console.error('🔴 Socket connection error:', {
            message: error.message,
            type: error.type,
            data: error.data
        });
        
        // ✅ ADD: More helpful error logging
        if (error.message === 'Client is closed') {
            console.warn('⚠️ Socket connection closed before establishing');
        }
        if (error.data?.content?.message === 'Invalid token') {
            console.error('❌ Authentication failed - Invalid token');
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
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