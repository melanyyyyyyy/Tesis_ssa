import { Schema, model, Document } from 'mongoose';

export interface IPendingDeletion extends Document {
    sigenId: string;
    targetModel: string;
    deletedAt: Date;
}

const PendingDeletionSchema = new Schema<IPendingDeletion>({
    sigenId: {
        type: String,
        required: true,
        index: true
    },
    targetModel: {
        type: String,
        required: true,
        enum: ['EvaluationScore'] 
    },
    deletedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    versionKey: false,
    collection: 'pending_deletions'
});

export default model<IPendingDeletion>('PendingDeletion', PendingDeletionSchema);
