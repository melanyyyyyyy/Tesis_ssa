import { Schema, model, Types, Document } from 'mongoose';

export interface INotification extends Document {
    recipientId: Types.ObjectId;
    title?: string;
    message: string;
    type: 'NEW_EVALUATION' | 'SYSTEM_ALERT' | 'INFO' | 'NEW_MESSAGE';
    isRead: boolean;
    link?: string;
    createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String },
    message: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['NEW_EVALUATION', 'SYSTEM_ALERT', 'INFO', 'NEW_MESSAGE'], 
        default: 'INFO',
        index: true
    },
    isRead: { type: Boolean, default: false },
    link: { type: String },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false, collection: 'notifications' });

export default model<INotification>('Notification', NotificationSchema);