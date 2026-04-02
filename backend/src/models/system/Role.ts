import { Schema, model, Document, Types } from 'mongoose';

export interface IRole extends Document {
    _id: Types.ObjectId;
    name: string;
}

const RoleSchema = new Schema<IRole>({
    name: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true,
        index: true,
        maxlength: 100
    },
}, { timestamps: true, versionKey: false, collection: 'roles' });

export default model<IRole>('Role', RoleSchema);