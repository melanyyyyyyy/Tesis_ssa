import { Schema, model, Document, Types } from 'mongoose';

export interface ICareer extends Document {
    _id: Types.ObjectId;
    sigenId: string;
    name: string;
    facultyId: Types.ObjectId;
    courseTypeId: Types.ObjectId;
}

const CareerSchema = new Schema<ICareer>(
    {
        sigenId: {
            type: String,
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
            index: true,
        },
        facultyId: {
            type: Schema.Types.ObjectId,
            ref: 'Faculty',
            required: true,
            index: true,
        },
        courseTypeId: {
            type: Schema.Types.ObjectId,
            ref: 'CourseType',
            required: true,
            index: true,
        },
    },
    {
        timestamps: true,
        collection: 'careers',
        versionKey: false
    }
);

CareerSchema.index({ facultyId: 1, courseTypeId: 1 });

CareerSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.sigenId;
    return obj;
};

export default model<ICareer>('Career', CareerSchema);
