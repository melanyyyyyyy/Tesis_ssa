import { Schema, model, Document, Types } from 'mongoose';

export interface IMatriculatedSubject extends Document {
    _id: Types.ObjectId;
    sigenId: string;
    studentId: Types.ObjectId;
    subjectId: Types.ObjectId;
    academicYear: number;
    evaluated: boolean;
}

const MatriculatedSubjectSchema = new Schema<IMatriculatedSubject>(
    {
        sigenId: {
            type: String,
            required: true,
            index: true,
        },
        studentId: {
            type: Schema.Types.ObjectId,
            ref: 'Student',
            required: true,
            index: true,
        },
        subjectId: {
            type: Schema.Types.ObjectId,
            ref: 'Subject',
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
        evaluated: {
            type: Boolean,
            default: false,
            index: true,
        }
    },
    {
        timestamps: true,
        collection: 'matriculated_subjects',
        versionKey: false
    }
);

/*
MatriculatedSubjectSchema.index({ studentId: 1, subjectId: 1, academicYear: 1});
MatriculatedSubjectSchema.index({ studentId: 1, evaluated: 1 });
*/

MatriculatedSubjectSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.sigenId;
    return obj;
};

export default model<IMatriculatedSubject>('MatriculatedSubject', MatriculatedSubjectSchema);
