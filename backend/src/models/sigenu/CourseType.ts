import { Schema, model, Document, Types } from 'mongoose';

export interface ICourseType extends Document {
    _id: Types.ObjectId;
    sigenId: string;
    name: string;
}

const CourseTypeSchema = new Schema<ICourseType>(
    {
        sigenId: {
            type: String,
            index: true,
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
            index: true,
            unique: true,
        },
    },
    {
        timestamps: true,
        collection: 'course_types',
        versionKey: false
    }
);

CourseTypeSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.sigenId;
    return obj;
};

export default model<ICourseType>('CourseType', CourseTypeSchema);
