import { Schema, model, Document, Types } from 'mongoose';
import { UserModel } from '../system/index.js';

export interface ISubject extends Document {
    _id: Types.ObjectId;
    sigenId: string;
    name: string;
    careerId: Types.ObjectId;
    academicYear: number;
    professorId?: Types.ObjectId;
}

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

SubjectSchema.index({ careerId: 1, academicYear: 1 });
SubjectSchema.index({
    name: 1,
    careerId: 1,
    academicYear: 1,
    professorId: 1
}, { unique: true, sparse: true });

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

export default model<ISubject>('Subject', SubjectSchema);
