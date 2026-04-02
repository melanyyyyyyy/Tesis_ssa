import { Schema, model, Document, Types } from 'mongoose';

export interface IStudent extends Document {
    _id: Types.ObjectId;
    sigenId: string;
    firstName: string;
    lastName: string;
    identification: string;
    email?: string;
    careerId: Types.ObjectId;
    courseTypeId: Types.ObjectId;
    academicYear: number;                   
    studentStatusId: Types.ObjectId;      
    isActive: boolean;                      
}

const StudentSchema = new Schema<IStudent>(
    {
        sigenId: {
            type: String,
            required: true,
            index: true,
        },
        firstName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
            index: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
            index: true,
        },
        identification: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
        },
        email: {
            type: String,
            sparse: true,
            lowercase: true,
            index: true,
            trim: true,
        },
        careerId: {
            type: Schema.Types.ObjectId,
            ref: 'Career',
            required: true,
            index: true,
        },
        courseTypeId: {
            type: Schema.Types.ObjectId,
            ref: 'CourseType',
            required: true,
            index: true,
        },
        academicYear: {
            type: Number,
            required: true,
            min: 1,
            max: 6,
            index: true,
        },
        studentStatusId: {
            type: Schema.Types.ObjectId,
            ref: 'StudentStatus',
            required: true,
            index: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        }
    },
    {
        timestamps: true,
        collection: 'students',
        versionKey: false
    }
);

StudentSchema.index({ careerId: 1, courseTypeId: 1, academicYear: 1 });
StudentSchema.index({ careerId: 1, academicYear: 1 });
StudentSchema.index({ firstName: 1, lastName: 1 });

StudentSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.sigenId;
    return obj;
};

export default model<IStudent>('Student', StudentSchema);
