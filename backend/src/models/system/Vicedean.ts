import { Schema, model, Document, Types } from 'mongoose';

export interface IVicedean extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;      
  facultyId: Types.ObjectId;          
}

const VicedeanSchema = new Schema<IVicedean>({
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
}, { timestamps: true, versionKey: false, collection: 'vicedeans' });

VicedeanSchema.index({ userId: 1, facultyId: 1 });

export default model<IVicedean>('Vicedean', VicedeanSchema);