import { Request, Response } from 'express';
import NotificationModel from '../models/system/Notification.js';
import { Types } from 'mongoose';

export const NotificationController = {
    async getMyNotifications(req: Request, res: Response): Promise<void> {
        try {
            const user = (req as any).user;
            const userIdString = user?._id || user?.id;
            
            if (!userIdString) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const userId = new Types.ObjectId(userIdString);

            const notifications = await NotificationModel.find({
                recipientId: userId
            })
                .sort({ createdAt: -1 })
                .limit(20)
                .lean();

            const unreadCount = await NotificationModel.countDocuments({
                recipientId: userId,
                isRead: false
            });

            res.json({
                notifications,
                unreadCount
            });
        } catch (error) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async markAsRead(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const user = (req as any).user;
            const userId = user?._id || user?.id;

            const notification = await NotificationModel.findOneAndUpdate(
                { _id: id, recipientId: userId },
                { $set: { isRead: true } },
                { new: true }
            );

            if (!notification) {
                res.status(404).json({ error: 'Notification not found' });
                return;
            }

            res.json(notification);
        } catch (error) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async markAllAsRead(req: Request, res: Response): Promise<void> {
        try {
            const user = (req as any).user;
            const userId = user?._id || user?.id;
            await NotificationModel.updateMany(
                { recipientId: userId, isRead: false },
                { $set: { isRead: true } }
            );

            res.json({ message: 'All notifications marked as read' });
        } catch (error) {
            console.error('Error marking all as read:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};




