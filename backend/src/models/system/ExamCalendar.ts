import { Schema, model, Document, Types } from 'mongoose';

export interface IExamCalendar extends Document {
    subjectId: Types.ObjectId;
    examinationTypeId: Types.ObjectId;
    careerId: Types.ObjectId;
    examDate: Date;
}

type ExamCalendarNotificationAction = 'created' | 'deleted';

const EXAM_CALENDAR_NOTIFICATION_REFERENCE_MODEL = 'ExamCalendar';
const STUDENT_EXAM_CALENDAR_PATH = '/student/exams';

async function resolveExamCalendarNotificationContext(subjectId: Types.ObjectId | string, careerId: Types.ObjectId | string) {
    const Subject = model('Subject');
    const MatriculatedSubject = model('MatriculatedSubject');
    const Student = model('Student');
    const User = model('User');

    const subject = await Subject.findById(subjectId)
        .select('_id name academicYear careerId')
        .lean() as {
        _id?: Types.ObjectId;
        name?: string;
        academicYear?: number;
        careerId?: Types.ObjectId;
    } | null;

    if (!subject?._id || !subject?.name || typeof subject.academicYear !== 'number' || !subject.careerId) {
        return null;
    }

    const matriculatedRows = await MatriculatedSubject.find({ subjectId: subject._id })
        .select('studentId')
        .lean() as Array<{ studentId?: Types.ObjectId }>;
    const matriculatedStudentIds = matriculatedRows
        .map((row) => row.studentId)
        .filter(Boolean) as Types.ObjectId[];

    if (matriculatedStudentIds.length === 0) {
        return null;
    }

    const eligibleStudents = await Student.find({
        _id: { $in: matriculatedStudentIds },
        careerId: careerId,
        academicYear: subject.academicYear
    })
        .select('_id')
        .lean() as Array<{ _id: Types.ObjectId }>;
    const eligibleStudentIds = eligibleStudents.map((student) => student._id);

    if (eligibleStudentIds.length === 0) {
        return null;
    }

    const users = await User.find({
        studentId: { $in: eligibleStudentIds }
    })
        .select('_id')
        .lean() as Array<{ _id: Types.ObjectId }>;

    if (users.length === 0) {
        return null;
    }

    return {
        recipientIds: users.map((user) => user._id),
        subjectName: subject.name
    };
}

async function deleteExamCalendarNotifications(examCalendarId: Types.ObjectId | string) {
    try {
        const Notification = model('Notification');
        await Notification.deleteMany({
            type: 'NEW_EXAM_CALENDAR',
            referenceModel: EXAM_CALENDAR_NOTIFICATION_REFERENCE_MODEL,
            referenceId: examCalendarId
        });
    } catch (error) {
        console.error('Error deleting exam calendar notifications:', error);
    }
}

async function createExamCalendarNotifications(
    examCalendarId: Types.ObjectId | string,
    subjectId: Types.ObjectId | string,
    careerId: Types.ObjectId | string,
    action: ExamCalendarNotificationAction
) {
    try {
        const context = await resolveExamCalendarNotificationContext(subjectId, careerId);
        if (!context) {
            return;
        }

        const Notification = model('Notification');
        const title = action === 'created' ? 'Nuevo examen programado' : 'Examen eliminado';
        const message = action === 'created'
            ? `Se ha programado un examen para la asignatura ${context.subjectName}.`
            : `Se ha eliminado un examen programado de la asignatura ${context.subjectName}.`;

        await Notification.insertMany(
            context.recipientIds.map((recipientId) => ({
                recipientId,
                title,
                message,
                type: 'NEW_EXAM_CALENDAR',
                link: STUDENT_EXAM_CALENDAR_PATH,
                referenceModel: EXAM_CALENDAR_NOTIFICATION_REFERENCE_MODEL,
                referenceId: examCalendarId
            }))
        );
    } catch (error) {
        console.error('Error creating exam calendar notifications:', error);
    }
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
        throw new Error(`Conflicto de horario: Ya existe otro examen programado para esta carrera el ${dateStr}.`);
    }
});

ExamCalendarSchema.pre('save', function () {
    this.$locals.notificationAction = this.isNew ? 'created' : null;
});

ExamCalendarSchema.post('save', async function () {
    const action = this.$locals.notificationAction as ExamCalendarNotificationAction | null | undefined;
    if (action) {
        await createExamCalendarNotifications(this._id, this.subjectId, this.careerId, action);
    }
});

ExamCalendarSchema.post('findOneAndDelete', async function (doc) {
    if (!doc?._id || !doc?.subjectId || !doc?.careerId) {
        return;
    }

    await deleteExamCalendarNotifications(doc._id);
    await createExamCalendarNotifications(doc._id, doc.subjectId, doc.careerId, 'deleted');
});

export default model<IExamCalendar>('ExamCalendar', ExamCalendarSchema);
