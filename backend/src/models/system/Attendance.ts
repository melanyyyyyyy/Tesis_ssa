import { Schema, model, Document, Types } from 'mongoose';

export interface IAttendance extends Document {
    _id: Types.ObjectId;
    studentId: Types.ObjectId;
    subjectId: Types.ObjectId;
    attendanceDate: Date;
    isPresent: boolean;
    justified: boolean;
    justificationReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

type AttendanceNotificationAction = 'created' | 'updated';

const ATTENDANCE_NOTIFICATION_REFERENCE_MODEL = 'Attendance';
const STUDENT_SUBJECT_DETAIL_PATH = '/student/subject-records-detail';
const NON_NOTIFIABLE_ATTENDANCE_FIELDS = new Set([
    'createdAt',
    'updatedAt'
]);

function getAttendanceNotificationAction(isNew: boolean, paths: string[]): AttendanceNotificationAction | null {
    if (isNew) {
        return 'created';
    }

    const hasMeaningfulChanges = paths.some((path) => !NON_NOTIFIABLE_ATTENDANCE_FIELDS.has(path));
    return hasMeaningfulChanges ? 'updated' : null;
}

function getMeaningfulAttendanceUpdatePaths(update: Record<string, any> | null | undefined): string[] {
    if (!update || typeof update !== 'object') {
        return [];
    }

    const updatedPaths = new Set<string>();
    const collectPaths = (value: Record<string, any> | null | undefined) => {
        if (!value || typeof value !== 'object') {
            return;
        }

        Object.keys(value).forEach((key) => {
            if (!key.startsWith('$')) {
                updatedPaths.add(key.split('.')[0]);
            }
        });
    };

    collectPaths(update);
    collectPaths(update.$set);
    collectPaths(update.$unset);

    return Array.from(updatedPaths).filter((path) => !NON_NOTIFIABLE_ATTENDANCE_FIELDS.has(path));
}

async function resolveAttendanceNotificationContext(studentId: Types.ObjectId | string, subjectId: Types.ObjectId | string) {
    const User = model('User');
    const Subject = model('Subject');

    const [studentUser, subject] = await Promise.all([
        User.findOne({ studentId }).select('_id').lean() as Promise<{ _id: Types.ObjectId } | null>,
        Subject.findById(subjectId).select('name').lean() as Promise<{ _id?: Types.ObjectId; name?: string } | null>
    ]);

    if (!studentUser?._id || !subject?._id || !subject?.name) {
        return null;
    }

    return {
        recipientId: studentUser._id,
        subjectId: String(subject._id),
        subjectName: subject.name
    };
}

async function createAttendanceNotification(
    attendanceId: Types.ObjectId | string,
    studentId: Types.ObjectId | string,
    subjectId: Types.ObjectId | string,
    action: AttendanceNotificationAction
) {
    try {
        const context = await resolveAttendanceNotificationContext(studentId, subjectId);
        if (!context) {
            return;
        }

        const Notification = model('Notification');
        const message = action === 'created'
            ? `Se te ha añadido un nuevo registro de asistencia en la asignatura ${context.subjectName}.`
            : `Se ha modificado el registro de asistencia de la asignatura ${context.subjectName}.`;

        await Notification.create({
            recipientId: context.recipientId,
            title: action === 'created' ? 'Nueva asistencia' : 'Asistencia modificada',
            message,
            type: 'NEW_ATTENDANCE',
            link: `${STUDENT_SUBJECT_DETAIL_PATH}?subjectId=${encodeURIComponent(context.subjectId)}`,
            referenceModel: ATTENDANCE_NOTIFICATION_REFERENCE_MODEL,
            referenceId: attendanceId
        });
    } catch (error) {
        console.error('Error creating attendance notification:', error);
    }
}

async function deleteAttendanceNotifications(attendanceIds: Array<Types.ObjectId | string>) {
    if (attendanceIds.length === 0) {
        return;
    }

    try {
        const Notification = model('Notification');
        await Notification.deleteMany({
            type: 'NEW_ATTENDANCE',
            referenceModel: ATTENDANCE_NOTIFICATION_REFERENCE_MODEL,
            referenceId: { $in: attendanceIds }
        });
    } catch (error) {
        console.error('Error deleting attendance notifications:', error);
    }
}

const AttendanceSchema = new Schema<IAttendance>({
    studentId: {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
        index: true
    },
    subjectId: {
        type: Schema.Types.ObjectId,
        ref: 'Subject',
        required: true,
        index: true
    },
    attendanceDate: {
        type: Date,
        required: true,
        index: true
    },
    isPresent: {
        type: Boolean,
        default: true,
        index: true
    },
    justified: {
        type: Boolean,
        default: false,
        index: true
    },
    justificationReason: {
        type: String,
        trim: true,
        sparse: true,
        maxlength: 500
    }
}, {
    timestamps: true,
    versionKey: false,
    collection: 'attendances'
});

AttendanceSchema.index({ studentId: 1, subjectId: 1, attendanceDate: 1 }, { unique: true });
AttendanceSchema.index({ studentId: 1, attendanceDate: 1 });
AttendanceSchema.index({ subjectId: 1, attendanceDate: 1 });

AttendanceSchema.methods.toJSON = function () {
    const obj = this.toObject();
    return obj;
};

AttendanceSchema.pre('save', async function (this: IAttendance) {
    const MatriculatedSubject = model('MatriculatedSubject');

    const matriculated = await MatriculatedSubject.findOne({
        studentId: this.studentId,
        subjectId: this.subjectId
    });

    if (!matriculated) {
        throw new Error(
            `The student does not have the subject enrolled. ` +
            `StudentId: ${this.studentId}, SubjectId: ${this.subjectId}`
        );
    }

    if (this.attendanceDate) {
        this.attendanceDate.setUTCHours(0, 0, 0, 0);
    }
});

AttendanceSchema.pre('save', function () {
    this.$locals.notificationAction = getAttendanceNotificationAction(this.isNew, this.modifiedPaths());
});

AttendanceSchema.pre('findOneAndUpdate', async function () {
    const update = this.getUpdate() as Record<string, any> | null;
    this.setOptions({
        ...this.getOptions(),
        new: true
    });
    (this as any)._notificationAction = getMeaningfulAttendanceUpdatePaths(update).length > 0 ? 'updated' : null;
});

AttendanceSchema.pre('deleteMany', async function () {
    const docs = await this.model.find(this.getQuery()).select('_id').lean() as Array<{ _id: Types.ObjectId }>;
    (this as any)._attendanceIdsToDelete = docs.map((doc) => doc._id);
});

AttendanceSchema.post('save', async function () {
    const action = this.$locals.notificationAction as AttendanceNotificationAction | null | undefined;
    if (action) {
        await createAttendanceNotification(this._id, this.studentId, this.subjectId, action);
    }
});

AttendanceSchema.post('findOneAndUpdate', async function (doc) {
    const action = (this as any)._notificationAction as AttendanceNotificationAction | null | undefined;
    if (action && doc?._id && doc?.studentId && doc?.subjectId) {
        await createAttendanceNotification(doc._id, doc.studentId, doc.subjectId, action);
    }
});

AttendanceSchema.post('findOneAndDelete', async function (doc) {
    if (doc?._id) {
        await deleteAttendanceNotifications([doc._id]);
    }
});

AttendanceSchema.post('deleteOne', { document: true, query: false }, async function () {
    await deleteAttendanceNotifications([this._id]);
});

AttendanceSchema.post('deleteMany', async function () {
    const attendanceIds = ((this as any)._attendanceIdsToDelete || []) as Array<Types.ObjectId | string>;
    await deleteAttendanceNotifications(attendanceIds);
});

export default model<IAttendance>('Attendance', AttendanceSchema);
