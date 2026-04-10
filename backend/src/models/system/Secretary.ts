import { Schema, model, Document, Types } from 'mongoose';

export interface ISecretary extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;      
  facultyId: Types.ObjectId;          
}

const SecretarySchema = new Schema<ISecretary>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true,
    index: true
  },
  facultyId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Faculty', 
    required: true,
    index: true
  }
}, { timestamps: true, versionKey: false, collection: 'secretaries' });

SecretarySchema.index({ userId: 1, facultyId: 1 });

export default model<ISecretary>('Secretary', SecretarySchema);
