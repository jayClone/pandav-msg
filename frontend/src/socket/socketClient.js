import io from 'socket.io-client';

let socket = null;

export const connectSocket = (token) => {
    // ✅ Disconnect old socket if exists
    if (socket) {
        console.log('🔄 Disconnecting old socket...');
        socket.disconnect();
        socket = null;
    }

    socket = io('http://localhost:5000', {
        auth: {
            token: token
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
    });

    socket.on('connect', () => {
        console.log('🟢 Socket connected:', socket.id);
    });

    socket.on('connect_error', (error) => {
        console.error('🔴 Socket connection error:', error.message);
    });

    socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
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