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

    // ✅ FIX: Detect URL properly
    let socketUrl = 'http://localhost:5000';
    
    console.log('🔍 SOCKET URL DETECTION');
    console.log('   Hostname:', window.location.hostname);
    console.log('   Protocol:', window.location.protocol);

    // ✅ Check if production
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        socketUrl = 'https://pandav-msg.up.railway.app';
        console.log('🌐 PRODUCTION - Using Railway');
    } else if (import.meta.env.VITE_API_URL) {
        socketUrl = import.meta.env.VITE_API_URL;
        console.log('🐳 DOCKER - Using VITE_API_URL');
    } else {
        console.log('💻 LOCAL - Using localhost');
    }
    
    console.log('🔌 CONNECTING TO:', socketUrl);
    console.log('   Token:', token ? '✅ Available' : '❌ Missing');

    socket = io(socketUrl, {
        auth: {
            token: token
        },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 20000,
        reconnectionAttempts: 30,
        connectTimeout: 60000,
        upgrade: true,
        rememberUpgrade: true,
        secure: window.location.protocol === 'https:',
        rejectUnauthorized: false,
        closeOnBeforeunload: false,
        forceBase64: false,
        withCredentials: true,
    });

    // ✅ Connection handlers
    socket.on('connect', () => {
        const transport = socket?.io?.engine?.transport?.name || 'unknown';
        console.log('✅ SOCKET CONNECTED');
        console.log('   ID:', socket.id);
        console.log('   Transport:', transport);
        console.log('   URL:', socketUrl);
        
        // ✅ Show alert on mobile data
        if (transport === 'polling') {
            console.warn('📱 Using polling (mobile data mode)');
        }
    });

    socket.on('connect_error', (error) => {
        console.error('\n❌ SOCKET CONNECTION ERROR\n');
        console.error('Message:', error.message);
        console.error('Type:', error.type);
        console.error('URL:', socketUrl);
        console.error('Token:', token ? 'Provided' : 'Missing');
        console.error('\n');
        
        // ✅ Specific diagnostics
        if (error.message?.includes('AUTH')) {
            console.error('🔐 AUTH ERROR - Token might be invalid/expired');
        }
        if (error.message?.includes('CORS')) {
            console.error('🚫 CORS ERROR - Backend blocking this origin');
        }
        if (error.message?.includes('timeout')) {
            console.error('⏱️ TIMEOUT - Backend too slow or unreachable');
        }
        if (error.message?.includes('econnrefused')) {
            console.error('🔌 CONNECTION REFUSED - Backend not running');
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('🔌 SOCKET DISCONNECTED');
        console.log('   Reason:', reason);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt #${attemptNumber}`);
    });

    socket.io?.engine?.on('upgrade', (transport) => {
        console.log('📡 TRANSPORT UPGRADED:', transport.name);
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