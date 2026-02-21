import io from 'socket.io-client';

const IS_DEV = import.meta.env.DEV; // ✅ True only in dev mode

let socket = null;

export const isSocketConnected = () => {
    return socket?.connected ?? false;
};

export const connectSocket = (token) => {
    if (socket) socket.disconnect();

    let socketUrl = 'http://localhost:5000';
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        socketUrl = import.meta.env.VITE_API_URL;
    }

    socket = io(socketUrl, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000,
        timeout: 20000,
        perMessageDeflate: {
            threshold: 1024 // Only compress messages > 1KB
        }
    });

    socket.on('connect', () => {
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Socket error:', error.message); // ✅ KEEP ERRORS
    });

    socket.on('disconnect', (reason) => {
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