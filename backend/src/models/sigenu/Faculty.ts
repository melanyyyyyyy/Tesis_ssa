import { Schema, model, Document, Types } from 'mongoose';

export interface IFaculty extends Document {
    _id: Types.ObjectId;
    sigenId: string;
    name: string;
}

const FacultySchema = new Schema<IFaculty>(
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
            maxlength: 200,
            index: true,
        }
    },
    {
        timestamps: true,
        collection: 'faculties',
        versionKey: false
    }
);

FacultySchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.sigenId;
    return obj;
};

export default model<IFaculty>('Faculty', FacultySchema);
