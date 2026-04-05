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

export default model<IAttendance>('Attendance', AttendanceSchema);
