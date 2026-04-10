import { Schema, model, Document, Types } from 'mongoose';

export enum EvaluationCategory {
  SYSTEMATIC_EVALUATION = 'SYSTEMATIC_EVALUATION',
  PARTIAL_EVALUATION = 'PARTIAL_EVALUATION',
  FINAL_EVALUATION = 'FINAL_EVALUATION',
}

export interface IEvaluationScore extends Document {
  studentId: Types.ObjectId;
  matriculatedSubjectId: Types.ObjectId;
  description: string;
  category: EvaluationCategory;
  evaluationValueId: Types.ObjectId;
  examinationTypeId?: Types.ObjectId;
  evaluationDate: Date;
  registrationDate?: Date | null;
  sigenId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EvaluationScoreSchema = new Schema<IEvaluationScore>({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  matriculatedSubjectId: {
    type: Schema.Types.ObjectId,
    ref: 'MatriculatedSubject',
    required: true,
    index: true,
  },
  description: {
    type: String,
    required: false,
    trim: true,
    maxlength: 50
  },
  category: {
    type: String,
    enum: Object.values(EvaluationCategory),
    required: true
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
    required: false,
    index: true,
  },
  evaluationDate: {
    type: Date,
    required: true,
    index: true,
  },
  registrationDate: {
    type: Date,
    default: null
  },
  sigenId: {
    type: String,
    required: false,
    index: true
  }
}, {
  timestamps: true,
  versionKey: false,
  collection: 'evaluation_scores'
});

EvaluationScoreSchema.index({ registrationDate: 1 });
EvaluationScoreSchema.index({ studentId: 1, matriculatedSubjectId: 1 });
EvaluationScoreSchema.index({ studentId: 1, matriculatedSubjectId: 1, category: 1 });
EvaluationScoreSchema.index({ studentId: 1, evaluationDate: -1 });
EvaluationScoreSchema.index({ matriculatedSubjectId: 1, evaluationDate: -1 });

async function updateSyncNotification(EvaluationModel: any) {
  try {
    const pendingCount = await EvaluationModel.countDocuments({
      category: 'FINAL_EVALUATION',
      $or: [
        { registrationDate: null },
        {
          $and: [
            { registrationDate: { $ne: null } },
            { $expr: { $gt: ["$updatedAt", { $add: ["$registrationDate", 10000] }] } }
          ]
        }
      ]
    });

    const Role = model('Role');
    const adminRole = await Role.findOne({ name: 'admin' });

    if (!adminRole) {
      console.warn('Role admin not found. Skipping notification update.');
      return;
    }

    const User = model('User');
    const admins = await User.find({ roleId: adminRole._id });

    if (admins.length === 0) return;

    const Notification = model('Notification');

    if (pendingCount === 0) {
      await Notification.deleteMany({
        recipientId: { $in: admins.map(s => s._id) },
        type: 'SYSTEM_ALERT',
        title: 'Sincronización Pendiente'
      });
      return;
    }

    const message = `Hay ${pendingCount} notas pendientes (nuevas o modificadas) que aún no han sido importadas al sistema SIGENU.`;

    const updates = admins.map(admin => {
      return Notification.findOneAndUpdate(
        {
          recipientId: admin._id,
          type: 'SYSTEM_ALERT',
          title: 'Sincronización Pendiente'
        },
        {
          $set: {
            message: message,
            isRead: false,
            updatedAt: new Date(),
            link: '/admin/sigenu-sync'
          }
        },
        { upsert: true, new: true }
      );
    });

    await Promise.all(updates);

  } catch (error) {
    console.error('Error updating sync notifications:', error);
  }
}

EvaluationScoreSchema.post('save', async function () {
  await updateSyncNotification(this.constructor);
});

EvaluationScoreSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await updateSyncNotification(this.model);
  }
});

EvaluationScoreSchema.post('deleteOne', { document: true, query: false }, async function () {
  await updateSyncNotification(this.constructor);
});

EvaluationScoreSchema.pre('deleteOne', { document: true, query: false }, async function () {
  try {
    if (this.sigenId) {
      const PendingDeletion = model('PendingDeletion');
      await PendingDeletion.create({
        sigenId: this.sigenId,
        targetModel: 'EvaluationScore'
      });
      console.log(`Marked EvaluationScore ${this._id} (SigenID: ${this.sigenId}) for deletion in SIGENU.`);
    }
  } catch (error) {
    console.error('Error in EvaluationScore pre-deleteOne hook:', error);
  }
});

EvaluationScoreSchema.pre('findOneAndDelete', async function () {
  try {
    const doc = await this.model.findOne(this.getQuery());
    if (doc && doc.sigenId) {
      const PendingDeletion = model('PendingDeletion');
      await PendingDeletion.create({
        sigenId: doc.sigenId,
        targetModel: 'EvaluationScore'
      });
      console.log(`Marked EvaluationScore ${doc._id} (SigenID: ${doc.sigenId}) for deletion in SIGENU (via findOneAndDelete).`);
    }
  } catch (error) {
    console.error('Error in EvaluationScore pre-findOneAndDelete hook:', error);
  }
});

export default model<IEvaluationScore>('EvaluationScore', EvaluationScoreSchema);
