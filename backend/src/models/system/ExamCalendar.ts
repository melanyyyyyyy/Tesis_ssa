import { Schema, model, Document, Types } from 'mongoose';

export interface IExamCalendar extends Document {
    subjectId: Types.ObjectId;
    examinationTypeId: Types.ObjectId;
    careerId: Types.ObjectId;
    examDate: Date;
}

const ExamCalendarSchema = new Schema<IExamCalendar>({
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    examinationTypeId: {
        type: Schema.Types.ObjectId,
        ref: 'ExaminationType',
        required: true,
        index: true,
    },
    careerId: { type: Schema.Types.ObjectId, ref: 'Career', required: true, index: true },
    examDate: { type: Date, required: true, index: true }
}, {
    timestamps: true,
    versionKey: false,
    collection: 'exam_calendars'
});

ExamCalendarSchema.index({ careerId: 1, examDate: 1 }, { unique: true });

ExamCalendarSchema.pre('save', async function (this: IExamCalendar) {
    const ExamCalendar = model<IExamCalendar>('ExamCalendar');
    const Subject = model('Subject');

    this.examDate.setHours(0, 0, 0, 0);

    const subject = await Subject.findById(this.subjectId);
    if (!subject) throw new Error('The associated subject does not exist.');

    const subjectCareerId = (subject as any).careerId;
    if (!subjectCareerId) {
        throw new Error('The subject has no associated career.');
    }

    if (subjectCareerId.toString() !== this.careerId.toString()) {
        throw new Error('The subject does not belong to the specified career.');
    }

    const careerConflict = await ExamCalendar.exists({
        careerId: this.careerId,
        examDate: this.examDate,
        _id: { $ne: this._id }
    });

    if (careerConflict) {
        const dateStr = this.examDate.toISOString().slice(0, 10);
        throw new Error(`Scheduling Conflict: Another exam is already scheduled for this career on ${dateStr}.`);
    }
});

export default model<IExamCalendar>('ExamCalendar', ExamCalendarSchema);