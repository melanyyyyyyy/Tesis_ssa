import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage extends Document {
    conversationId: Types.ObjectId;
    senderId: Types.ObjectId;
    content: string;
    isRead: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
    {
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true,
        },
        senderId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        content: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000, 
        },
        isRead: {
            type: Boolean,
            default: false, 
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

messageSchema.index({ senderId: 1, isRead: 1 });

export default model<IMessage>('Message', messageSchema);
