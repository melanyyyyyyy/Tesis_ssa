import { Schema, model, Document, Types } from 'mongoose';

export interface IRoleRequest extends Document {
    _id: Types.ObjectId;
    user: Schema.Types.ObjectId;
    faculty?: Schema.Types.ObjectId | null;
    requestedRole: Types.ObjectId;
    status: 'pending' | 'reviewed';
}

const RoleRequestSchema = new Schema<IRoleRequest>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    faculty: { type: Schema.Types.ObjectId, ref: 'Faculty', default: null },
    requestedRole: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    status: { type: String, enum: ['pending', 'reviewed'], default: 'pending' }
}, { timestamps: true });

RoleRequestSchema.index(
    { user: 1 },
    {
        unique: true,
        partialFilterExpression: { status: 'pending' }
    }
);

export default model<IRoleRequest>('RoleRequest', RoleRequestSchema);
