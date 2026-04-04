import { Schema, model, Document, Types } from 'mongoose';

export interface IConversation extends Document {
    participants: Types.ObjectId[];
    lastMessage?: Types.ObjectId; 
    createdAt: Date;
    updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
    {
        participants: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User', 
                required: true,
            },
        ],
        lastMessage: {
            type: Schema.Types.ObjectId,
            ref: 'Message',
            default: null,
        },
    },
    {
        timestamps: true, 
        versionKey: false,
    }
);

conversationSchema.index({ participants: 1 });

export default model<IConversation>('Conversation', conversationSchema);