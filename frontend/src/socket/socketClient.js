import io from 'socket.io-client';

const IS_DEV = import.meta.env.DEV; 

let socket = null;

export const isSocketConnected = () => {
    return socket?.connected ?? false;
};

export const connectSocket = (token) => {
    // `socket.active` is true while the socket is connected *or* still
    // auto-retrying a drop — i.e. still a live, usable connection. Layoute
    // calls connectSocket() again every time the REST access token rotates
    // (routine, happens on every silent refresh), which used to tear down
    // and recreate a perfectly healthy socket on every single one of those
    // — Socket.IO only checks the token once at handshake time, so a
    // rotated REST token is not a reason to reconnect. Only build a new
    // socket when there truly isn't a usable one (first connect, after an
    // explicit disconnectSocket() at logout, or once reconnection attempts
    // are actually exhausted).
    if (socket?.active) {
        return socket;
    }

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
            threshold: 1024 
        }
    });

    socket.on('connect', () => {
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Socket error:', error.message); 
    });

    socket.on('disconnect', () => {
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