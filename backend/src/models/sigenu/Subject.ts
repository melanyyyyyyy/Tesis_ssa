import { Schema, model, Document, Types } from 'mongoose';
import { NotificationModel, UserModel } from '../system/index.js';

export interface ISubject extends Document {
    _id: Types.ObjectId;
    sigenId: string;
    name: string;
    careerId: Types.ObjectId;
    academicYear: number;
    professorId?: Types.ObjectId;
}

const notifyProfessorAssignment = async (professorId: Types.ObjectId | string, subjectName: string) => {
    await NotificationModel.create({
        recipientId: professorId,
        title: 'Nueva asignatura asignada',
        message: `Se te ha asignado la asignatura "${subjectName}".`,
        type: 'INFO',
        link: '/professor/dashboard'
    });
};

const SubjectSchema = new Schema<ISubject>(
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
        },
        careerId: {
            type: Schema.Types.ObjectId,
            ref: 'Career',
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
        professorId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            index: true,
            sparse: true
        }
    },
    {
        timestamps: true,
        collection: 'subjects',
        versionKey: false
    }
);
/*

SubjectSchema.index({ careerId: 1, academicYear: 1 });

SubjectSchema.index({
    name: 1,
    careerId: 1,
    academicYear: 1,
    professorId: 1
}, { unique: true, sparse: true });
*/

SubjectSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.sigenId;
    return obj;
};

SubjectSchema.pre('save', async function (this: ISubject) {
    if (this.professorId) {
        const user = await UserModel.findById(this.professorId).populate('roleId');
        if (!user) throw new Error('The assigned professor does not exist.');
        
        const role = user.roleId as any;
        if (role.name !== 'PROFESSOR') throw new Error('The assigned user must have the PROFESSOR role.');
    }
});

SubjectSchema.post('save', async function (doc: ISubject) {
    if (!doc.professorId || !doc.isModified('professorId')) {
        return;
    }

    await notifyProfessorAssignment(doc.professorId, doc.name);
});

SubjectSchema.pre('findOneAndUpdate', async function () {
    const currentSubject = await this.model.findOne(this.getQuery()).select('_id name professorId').lean();
    (this as any)._currentSubject = currentSubject;
});

SubjectSchema.post('findOneAndUpdate', async function (doc) {
    const currentSubject = (this as any)._currentSubject as { name?: string; professorId?: Types.ObjectId | string | null } | null;
    const update = this.getUpdate() as {
        professorId?: Types.ObjectId | string | null;
        $set?: { professorId?: Types.ObjectId | string | null };
    } | null;

    const nextProfessorId = update?.$set?.professorId ?? update?.professorId;
    const previousProfessorId = currentSubject?.professorId ? String(currentSubject.professorId) : null;

    if (!doc || !nextProfessorId || previousProfessorId === String(nextProfessorId)) {
        return;
    }

    await notifyProfessorAssignment(nextProfessorId, doc.name);
});

export default model<ISubject>('Subject', SubjectSchema);
