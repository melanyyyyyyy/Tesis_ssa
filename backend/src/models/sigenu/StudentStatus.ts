import { Schema, model, Document, Types } from 'mongoose';

export interface IStudentStatus extends Document {
    _id: Types.ObjectId;
    sigenId: string;
    kind: string;
}

const StudentStatusSchema = new Schema<IStudentStatus>(
    {
        sigenId: {
            type: String,
            index: true,
            required: true
        },
        kind: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
            index: true,
        }
    },
    {
        timestamps: true,
        collection: 'student_statuses',
        versionKey: false
    }
);

StudentStatusSchema.methods.toJSON = function () {
    const obj = this.toObject();
    return obj;
};

export default model<IStudentStatus>('StudentStatus', StudentStatusSchema);
