import jwt from 'jsonwebtoken';
import { MESSAGES } from '../constant/response.messages.js';

export function socketAuthMiddleware(socket, next) {
    try {
        console.log('[SOCKET-AUTH] Authentication check...');
        console.log('   Headers:', Object.keys(socket.handshake.headers));
        console.log('   Auth payload:', socket.handshake.auth ? Object.keys(socket.handshake.auth) : 'NONE');
        
        const tokenFromAuth = socket.handshake?.auth?.token;
        const authHeader = socket.handshake?.headers?.authorization;

        let token = tokenFromAuth;

        console.log('   Token from auth:', tokenFromAuth ? '✅ YES' : '❌ NO');
        console.log('   Token from header:', authHeader ? '✅ YES' : '❌ NO');

        if (!token && authHeader?.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
            console.log('   Extracted from header:', token ? '✅ YES' : '❌ NO');
        }

        if (!token) {
            return next(new Error(`AUTH_ERROR : ${MESSAGES.AUTH.TOKEN_MISSING}`));
        }
        
        console.log('   Token length:', token.length);
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        console.log('✅ [SOCKET-AUTH] Token verified');
        console.log('   User ID:', decoded.userId);
        console.log('   Email:', decoded.email);
        console.log('   Name:', decoded.name);
        
        socket.user = {
            userId: decoded.userId,
            email: decoded.email,
            name: decoded.name
        };

        return next();
    } catch (error) {
        return next(new Error(`AUTH_ERROR : ${MESSAGES.AUTH.TOKEN_INVALID}`));
    }
}