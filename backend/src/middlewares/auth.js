import jwt from 'jsonwebtoken'
import User from "../models/User.js"

// middleware for route protection
export const protect = async (req, res, next) =>{
    try {
        // get token from header
        const token = req.headers.authorization?.split(' ')[1];

        if (!token){
            return res.status(401).json({
                success: false,
                message: 'Please Login'
            });
        }

        //verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        //get user from token
        req.user = await User.findById(decoded.userId);

        if(!req.user){
            return res.status(401).json({
                success: false,
                message: 'user not found'
            })
        }

        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Token is invalid or expired'
        })
        
    }
}