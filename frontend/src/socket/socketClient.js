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

    // ✅ Detect environment
    let socketUrl = 'http://localhost:5000';
    
    console.log('🔍 SOCKET URL DETECTION');
    console.log('   Hostname:', window.location.hostname);
    console.log('   Protocol:', window.location.protocol);

    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        socketUrl = 'https://pandav-msg.up.railway.app';
        console.log('🌐 PRODUCTION - Using Railway');
    } else if (import.meta.env.VITE_API_URL) {
        socketUrl = import.meta.env.VITE_API_URL;
        console.log('🐳 DOCKER - Using VITE_API_URL');
    }
    
    console.log('🔌 CONNECTING TO:', socketUrl);
    console.log('   Transports: polling (primary) + websocket (fallback)');

    socket = io(socketUrl, {
        auth: {
            token: token
        },
        
        // ✅ Polling FIRST
        transports: ['polling', 'websocket'],
        
        // ✅ Reconnection config
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 20000,
        reconnectionAttempts: 50,  // ✅ INCREASED - keep trying
        
        // ✅ Long timeout for mobile
        connectTimeout: 60000,
        
        // ✅ Polling-specific config
        upgrade: true,
        rememberUpgrade: true,
        
        // ✅ Protocol
        secure: window.location.protocol === 'https:',
        rejectUnauthorized: false,
        
        // ✅ Mobile-friendly
        closeOnBeforeunload: false,
        forceBase64: false,
        
        // ✅ Credentials
        withCredentials: true,
        
        // ✅ XHR polling config
        transportOptions: {
          polling: {
            extraHeaders: {
              'Authorization': `Bearer ${token}`
            }
          }
        }
    });

    // ✅ Connection events
    socket.on('connect', () => {
        const transport = socket?.conn?.transport?.name || 'unknown';
        console.log('✅ SOCKET CONNECTED');
        console.log('   ID:', socket.id);
        console.log('   Transport:', transport);
        
        if (transport === 'polling') {
            console.warn('📱 Using polling (mobile data mode)');
        }
    });

    socket.on('connect_error', (error) => {
        console.error('\n❌ SOCKET CONNECTION ERROR\n');
        console.error('Message:', error.message);
        console.error('Type:', error.type);
        console.error('URL:', socketUrl);
        console.error('\n');
        
        if (error.message?.includes('AUTH')) {
            console.error('🔐 AUTH ERROR - Invalid token');
        }
        if (error.message?.includes('poll')) {
            console.error('📡 POLLING ERROR - Backend not accepting polling requests');
            console.error('   Check: Backend socket.server.js has polling enabled');
        }
        if (error.message?.includes('CORS')) {
            console.error('🚫 CORS ERROR - Backend blocking this origin');
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('🔌 SOCKET DISCONNECTED');
        console.log('   Reason:', reason);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt #${attemptNumber}...`);
    });

    // ✅ XHR transport specific events
    socket.io?.engine?.on('poll', () => {
        console.log('📊 Polling request...');
    });

    socket.io?.engine?.on('error', (error) => {
        console.error('❌ Engine Error:', error);
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