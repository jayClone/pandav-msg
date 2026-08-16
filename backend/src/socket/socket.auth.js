import jwt from 'jsonwebtoken';
import { MESSAGES } from '../constant/response.messages.js';

export function socketAuthMiddleware(socket, next) {
    try {
        const tokenFromAuth = socket.handshake?.auth?.token;
        const authHeader = socket.handshake?.headers?.authorization;

        let token = tokenFromAuth;

        if (!token && authHeader?.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        if (!token) {
            return next(new Error(`AUTH_ERROR : ${MESSAGES.AUTH.TOKEN_MISSING}`));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type !== 'access') {
            return next(new Error(`AUTH_ERROR : ${MESSAGES.AUTH.TOKEN_INVALID}`));
        }

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