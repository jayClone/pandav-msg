import io from 'socket.io-client';

let socket = null;

export const isSocketConnected = () => {
    return socket?.connected ?? false;
};

export const connectSocket = (token) => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    // ✅ Simple URL detection
    let socketUrl = 'http://localhost:5000';
    
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        socketUrl = import.meta.env.VITE_API_URL || 'https://pandav-msg.up.railway.app';
    }

    socket = io(socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 20000,
        reconnectionAttempts: 50,
        connectTimeout: 60000,
        upgrade: true,
        secure: window.location.protocol === 'https:',
        withCredentials: true,
    });

    socket.on('connect', () => {
        console.log('✅ Socket connected:', socket.id);
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Socket error:', error.message);
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
    }
};

export const getSocket = () => {
    return socket;
};