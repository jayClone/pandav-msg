import io from 'socket.io-client';
import { Capacitor } from '@capacitor/core';

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
        // Keep the live socket's auth payload current even though we're not
        // rebuilding the connection — Socket.IO reads `socket.auth` fresh
        // right before each (re)connection attempt (the documented pattern
        // for updating credentials: https://socket.io/docs/v4/client-options/#auth).
        // Without this, the access token captured at the original io() call
        // just sits there until this socket eventually needs to reconnect
        // (a network blip, phone sleep/wake, server restart) — and since
        // JWT_ACCESS_EXPIRE is only 15 minutes, any session older than that
        // would retry all 3 reconnection attempts with an already-expired
        // token and permanently fail, silently killing every real-time
        // feature until a manual page reload.
        socket.auth.token = token;
        return socket;
    }

    if (socket) socket.disconnect();

    let socketUrl = 'http://localhost:5000';
    // The Capacitor Android app's WebView hostname is ALSO "localhost"
    // (its own local virtual host, not a real dev server) — check the
    // native platform explicitly rather than relying on hostname alone,
    // or the packaged app silently tries to reach a socket server on the
    // phone itself instead of the real backend.
    const isRealWebDeployment = !Capacitor.isNativePlatform()
        && window.location.hostname !== 'localhost'
        && window.location.hostname !== '127.0.0.1';
    if (Capacitor.isNativePlatform() || isRealWebDeployment) {
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