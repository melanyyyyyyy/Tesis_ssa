import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    try {
        let token = req.headers.authorization?.split(' ')[1];
        
        if (!token && req.query.token) {
            token = req.query.token as string;
        }

        if (!token) {
            console.warn(`[Auth] Missing token for ${req.method} ${req.path}`);
            res.status(401).json({ error: 'Authentication required. No token provided.' });
            return;
        }

        const decoded = jwt.verify(
            token, 
            process.env.JWT_SECRET || 'secret_key_change_me'
        );
        
        req.user = decoded;
        next();
    } catch (error) {
        console.error(`[Auth] Token verification failed:`, error instanceof Error ? error.message : error);
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

export const authorize = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ message: 'User not authenticated' });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
            return;
        }

        next();
    };
};
