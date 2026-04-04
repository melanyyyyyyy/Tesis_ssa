import { Schema, model, Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email?: string;
  identification: string;
  firstName: string;
  lastName: string;
  roleId?: Types.ObjectId;     
  studentId?: Types.ObjectId; 
  isActive: boolean;
  createdAt: Date; 
  updatedAt: Date;      
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: false, lowercase: true },
  identification: { type: String, required: true, unique: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: false, index: true },
  studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
  isActive: { type: Boolean, default: true, index: true, },
}, { timestamps: true, versionKey: false, collection: 'users' });

UserSchema.index({ email: 1 }, { unique: true, sparse: true });

UserSchema.index({ email: 1, roleId: 1 }, { 
  unique: true, 
  partialFilterExpression: { email: { $type: 'string' } } 
});

export default model<IUser>('User', UserSchema);