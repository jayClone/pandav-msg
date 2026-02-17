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
    console.log('   Token available:', !!token);
    console.log('   Token length:', token?.length || 0);

    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        socketUrl = 'https://pandav-msg.up.railway.app';
        console.log('🌐 PRODUCTION - Using Railway');
    } else if (import.meta.env.VITE_API_URL) {
        socketUrl = import.meta.env.VITE_API_URL;
        console.log('🐳 DOCKER - Using VITE_API_URL');
    }
    
    console.log('🔌 CONNECTING TO:', socketUrl);
    console.log('   Transports: polling (primary) + websocket (fallback)');
    console.log('   Auth token provided:', !!token);

    socket = io(socketUrl, {
        auth: {
            token: token
        },
        
        // ✅ Polling FIRST
        transports: ['websocket'],
        
        // ✅ Reconnection config
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 20000,
        reconnectionAttempts: 50,
        
        // ✅ Long timeout for mobile
        connectTimeout: 60000,
        
        // ✅ Polling-specific config
        upgrade: true,
        rememberUpgrade: true,
        
        // ✅ Protocol
        secure: window.location.protocol === 'https:',
        
        // ✅ Mobile-friendly
        closeOnBeforeunload: false,
        forceBase64: false,
        
        // ✅ Credentials
        withCredentials: true,
        
        // ✅ XHR polling config with headers
        transportOptions: {
            polling: {
            }
        }
    });

    // ✅ Connection success
    socket.on('connect', () => {
        const transport = socket?.conn?.transport?.name || 'unknown';
        console.log('✅✅✅ SOCKET CONNECTED ✅✅✅');
        console.log('   ID:', socket.id);
        console.log('   Transport:', transport);
        console.log('   URL:', socketUrl);
        
        if (transport === 'polling') {
            console.log('📱 [MOBILE MODE] Using HTTP Long-Polling');
        } else if (transport === 'websocket') {
            console.log('⚡ [FAST MODE] Using WebSocket');
        }
    });

    // ✅ XHR SPECIFIC ERROR HANDLING
    socket.io?.engine?.on('error', (error) => {
        console.error('\n❌ ENGINE ERROR ❌\n');
        console.error('Error:', error);
        console.error('Error type:', error.type);
        console.error('Error message:', error.message);
        console.error('\n');
    });

    // ✅ DETAILED CONNECTION ERROR
    socket.on('connect_error', (error) => {
        console.error('\n🔴🔴🔴 SOCKET CONNECTION ERROR 🔴🔴🔴');
        console.error('Message:', error.message);
        console.error('Type:', error.type);
        console.error('Data:', error.data);
        console.error('URL:', socketUrl);
        console.error('Token:', token ? `${token.substring(0, 20)}...` : 'MISSING');
        console.error('\n');
        
        // ✅ Specific error diagnostics
        if (error.message?.includes('AUTH')) {
            console.error('🔐 [AUTH ERROR]');
            console.error('   - Token is invalid or expired');
            console.error('   - Backend rejected authentication');
            console.error('   - Check backend socket.auth.js');
        }
        
        if (error.message?.includes('poll')) {
            console.error('📡 [POLLING ERROR]');
            console.error('   - Backend not accepting polling requests');
            console.error('   - Check: cors.options.methods includes GET, POST');
            console.error('   - Check: transports includes polling');
            console.error('   - Check: No middleware blocking polling');
        }
        
        if (error.message?.includes('CORS') || error.message?.includes('405')) {
            console.error('🚫 [CORS/405 ERROR]');
            console.error('   - Backend blocking this request');
            console.error('   - Check: /socket.io/ endpoint exists');
            console.error('   - Check: CORS allows this origin');
            console.error('   - Check: Methods: GET, POST, OPTIONS');
        }
        
        if (error.message?.includes('econnrefused') || error.message?.includes('refused')) {
            console.error('🔌 [CONNECTION REFUSED]');
            console.error('   - Backend is not running or unreachable');
            console.error('   - Check if Railway backend is deployed');
            console.error('   - Try: curl ' + socketUrl);
        }
        
        if (error.message?.includes('timeout')) {
            console.error('⏱️ [TIMEOUT ERROR]');
            console.error('   - Backend too slow or unreachable');
            console.error('   - Network latency issue');
            console.error('   - Try reducing connectTimeout');
        }
        
        console.error('🔴🔴🔴\n');
    });

    // ✅ Transport upgrade/downgrade
    socket.io?.engine?.on('upgrade', (transport) => {
        console.log('📡 [UPGRADE] Transport upgraded to:', transport.name);
    });

    socket.io?.engine?.on('downgrade', (transport) => {
        console.warn('📉 [DOWNGRADE] Transport downgraded to:', transport.name);
    });

    // ✅ Request events (XHR specific)
    socket.io?.engine?.on('poll', () => {
        console.log('📊 [POLLING] Polling request sent...');
    });

    // ✅ Disconnect
    socket.on('disconnect', (reason) => {
        console.log('❌ Socket disconnected');
        console.log('   Reason:', reason);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`🔄 Reconnection attempt #${attemptNumber}...`);
    });

    socket.on('reconnect_failed', () => {
        console.error('❌ Reconnection permanently failed');
        console.error('   Backend may be down or unreachable');
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