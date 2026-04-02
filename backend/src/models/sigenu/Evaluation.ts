import { Schema, model, Document, Types } from 'mongoose';

export interface IEvaluation extends Document {
    _id: Types.ObjectId;
    sigenId: string;
    studentId: Types.ObjectId;
    matriculatedSubjectId: Types.ObjectId;
    evaluationValueId: Types.ObjectId;
    examinationTypeId: Types.ObjectId;
    evaluationDate: Date;
    registrationDate: Date;
}

const EvaluationSchema = new Schema<IEvaluation>(
    {
        sigenId: {
            type: String,
            index: true,
            required: true,
        },
        studentId: {
            type: Schema.Types.ObjectId,
            ref: 'Student',
            required: true,
            index: true,
        },
        matriculatedSubjectId: {
            type: Schema.Types.ObjectId,
            ref: 'MatriculatedSubject',
            required: true,
            index: true,
        },
        evaluationValueId: {
            type: Schema.Types.ObjectId,
            ref: 'EvaluationValue',
            required: true,
            index: true,
        },
        examinationTypeId: {
            type: Schema.Types.ObjectId,
            ref: 'ExaminationType',
            required: true,
            index: true,
        },
        evaluationDate: {
            type: Date,
            required: true,
            index: true,
        },
        registrationDate: {
            type: Date,
            required: true,
            index: true,
        }
    },
    {
        timestamps: true,
        collection: 'evaluations',
        versionKey: false
    }
);

EvaluationSchema.index({ studentId: 1, matriculatedSubjectId: 1 });
EvaluationSchema.index({ studentId: 1, examinationTypeId: 1 });
EvaluationSchema.index({ matriculatedSubjectId: 1, examinationTypeId: 1 });
EvaluationSchema.index({ registrationDate: 1 }, { sparse: true });

EvaluationSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.sigenId;
    return obj;
};

EvaluationSchema.pre('save', async function (this: IEvaluation) {
    const MatriculatedSubject = model('MatriculatedSubject');

    const matriculated = await MatriculatedSubject.findOne({
        _id: this.matriculatedSubjectId,
        studentId: this.studentId
    });

    if (!matriculated) {
        throw new Error(
            `The MatriculatedSubject does not exist or does not belong to the student. ` +
            `StudentId: ${this.studentId}, MatriculatedSubjectId: ${this.matriculatedSubjectId}`
        );
    }
});

export default model<IEvaluation>('Evaluation', EvaluationSchema);
