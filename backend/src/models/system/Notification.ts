import { Schema, model, Types, Document } from 'mongoose';

export interface INotification extends Document {
    recipientId: Types.ObjectId;
    conversationId?: Types.ObjectId | null;
    lastMessageId?: Types.ObjectId | null;
    senderId?: Types.ObjectId | null;
    referenceModel?: string | null;
    referenceId?: Types.ObjectId | null;
    title?: string;
    message: string;
    type: 'NEW_EVALUATION' | 'NEW_ATTENDANCE' | 'NEW_EXAM_CALENDAR' | 'SYSTEM_ALERT' | 'INFO' | 'NEW_MESSAGE';
    isRead: boolean;
    link?: string;
    createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', default: null },
    lastMessageId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    referenceModel: { type: String, default: null, index: true },
    referenceId: { type: Schema.Types.ObjectId, default: null, index: true },
    title: { type: String },
    message: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['NEW_EVALUATION', 'NEW_ATTENDANCE', 'NEW_EXAM_CALENDAR', 'SYSTEM_ALERT', 'INFO', 'NEW_MESSAGE'], 
        default: 'INFO',
        index: true
    },
    isRead: { type: Boolean, default: false },
    link: { type: String },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false, collection: 'notifications' });

NotificationSchema.index(
    { recipientId: 1, conversationId: 1, type: 1 },
    {
        partialFilterExpression: {
            type: 'NEW_MESSAGE',
            conversationId: { $type: 'objectId' }
        }
    }
);

NotificationSchema.index({ recipientId: 1, type: 1, referenceModel: 1, referenceId: 1 });

export default model<INotification>('Notification', NotificationSchema);
