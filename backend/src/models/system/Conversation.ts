import { Schema, model, Document, Types } from 'mongoose';

export interface IConversation extends Document {
    participants: Types.ObjectId[];
    subjectId: Types.ObjectId;
    kind: 'group' | 'private';
    title: string;
    studentId?: Types.ObjectId | null;
    studentUserId?: Types.ObjectId | null;
    lastMessage?: Types.ObjectId | null;
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
        subjectId: {
            type: Schema.Types.ObjectId,
            ref: 'Subject',
            required: true,
            index: true,
        },
        kind: {
            type: String,
            enum: ['group', 'private'],
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        studentId: {
            type: Schema.Types.ObjectId,
            ref: 'Student',
            default: null,
        },
        studentUserId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
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
conversationSchema.index(
    { subjectId: 1, kind: 1 },
    { unique: true, partialFilterExpression: { kind: 'group' } }
);
conversationSchema.index(
    { subjectId: 1, kind: 1, studentId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            kind: 'private',
            studentId: { $type: 'objectId' }
        }
    }
);

export default model<IConversation>('Conversation', conversationSchema);
