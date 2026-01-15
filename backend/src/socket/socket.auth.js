import jwt from 'jsonwebtoken';

export function socketAuthMiddleware(socket, next){
    try {
    // token can come from:
    // socket.handshake.auth.token (recommended)
    // or header: Authorization: Bearer xxx
        const tokenFromAuth = socket.handshake?.auth?.token;
        const authHeader = socket.handshake?.header?.authorization;

        let token = tokenFromAuth;

        if (!token && authHeader?.startsWith("Bearer ")){
            token = authHeader.split(" ")[1];
        }

        if(!token){
            return next(new Error("AUTH_ERROR : Token is missing"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        //attach user info of user for later use
        socket.user = {
            userId: decoded.userId,
            email: decoded.email,
        };

        return next();
    } catch (error) {
        return next(new Error("AUTH_ERROR : Token is missing"))
    }
}