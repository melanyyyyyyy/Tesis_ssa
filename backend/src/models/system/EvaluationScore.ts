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

type EvaluationNotificationAction = 'created' | 'updated';

const EVALUATION_NOTIFICATION_REFERENCE_MODEL = 'EvaluationScore';
const STUDENT_SUBJECT_DETAIL_PATH = '/student/subject-records-detail';
const NON_NOTIFIABLE_EVALUATION_FIELDS = new Set([
  'registrationDate',
  'sigenId',
  'createdAt',
  'updatedAt'
]);

function getNotificationAction(isNew: boolean, paths: string[]): EvaluationNotificationAction | null {
  if (isNew) {
    return 'created';
  }

  const hasMeaningfulChanges = paths.some((path) => !NON_NOTIFIABLE_EVALUATION_FIELDS.has(path));
  return hasMeaningfulChanges ? 'updated' : null;
}

function getMeaningfulUpdatePaths(update: Record<string, any> | null | undefined): string[] {
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

  return Array.from(updatedPaths).filter((path) => !NON_NOTIFIABLE_EVALUATION_FIELDS.has(path));
}

async function resolveEvaluationNotificationContext(matriculatedSubjectId: Types.ObjectId | string) {
  const MatriculatedSubject = model('MatriculatedSubject');
  const Subject = model('Subject');
  const User = model('User');

  const matriculatedSubject = await MatriculatedSubject.findById(matriculatedSubjectId)
    .select('studentId subjectId')
    .lean() as { studentId?: Types.ObjectId; subjectId?: Types.ObjectId } | null;

  if (!matriculatedSubject?.studentId || !matriculatedSubject?.subjectId) {
    return null;
  }

  const [studentUser, subject] = await Promise.all([
    User.findOne({ studentId: matriculatedSubject.studentId }).select('_id').lean() as Promise<{ _id: Types.ObjectId } | null>,
    Subject.findById(matriculatedSubject.subjectId).select('name').lean() as Promise<{ name?: string } | null>
  ]);

  if (!studentUser?._id || !subject?.name) {
    return null;
  }

  return {
    recipientId: studentUser._id,
    subjectId: String(matriculatedSubject.subjectId),
    subjectName: subject.name
  };
}

async function createEvaluationNotification(
  evaluationId: Types.ObjectId | string,
  matriculatedSubjectId: Types.ObjectId | string,
  action: EvaluationNotificationAction
) {
  try {
    const context = await resolveEvaluationNotificationContext(matriculatedSubjectId);
    if (!context) {
      return;
    }

    const Notification = model('Notification');
    const message = action === 'created'
      ? `Se te ha añadido una nueva evaluación en la asignatura ${context.subjectName}.`
      : `Se ha modificado la evaluación de la asignatura ${context.subjectName}.`;

    await Notification.create({
      recipientId: context.recipientId,
      title: action === 'created' ? 'Nueva evaluación' : 'Evaluación modificada',
      message,
      type: 'NEW_EVALUATION',
      link: `${STUDENT_SUBJECT_DETAIL_PATH}?subjectId=${encodeURIComponent(context.subjectId)}`,
      referenceModel: EVALUATION_NOTIFICATION_REFERENCE_MODEL,
      referenceId: evaluationId
    });
  } catch (error) {
    console.error('Error creating evaluation notification:', error);
  }
}

async function deleteEvaluationNotifications(evaluationId: Types.ObjectId | string) {
  try {
    const Notification = model('Notification');
    await Notification.deleteMany({
      type: 'NEW_EVALUATION',
      referenceModel: EVALUATION_NOTIFICATION_REFERENCE_MODEL,
      referenceId: evaluationId
    });
  } catch (error) {
    console.error('Error deleting evaluation notifications:', error);
  }
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

EvaluationScoreSchema.pre('save', function () {
  this.$locals.notificationAction = getNotificationAction(this.isNew, this.modifiedPaths());
});

EvaluationScoreSchema.pre('findOneAndUpdate', async function () {
  const update = this.getUpdate() as Record<string, any> | null;
  this.setOptions({
    ...this.getOptions(),
    new: true
  });
  (this as any)._notificationAction = getMeaningfulUpdatePaths(update).length > 0 ? 'updated' : null;
});

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
  const action = this.$locals.notificationAction as EvaluationNotificationAction | null | undefined;
  if (action) {
    await createEvaluationNotification(this._id, this.matriculatedSubjectId, action);
  }
  await updateSyncNotification(this.constructor);
});

EvaluationScoreSchema.post('findOneAndUpdate', async function (doc) {
  const action = (this as any)._notificationAction as EvaluationNotificationAction | null | undefined;
  if (action && doc?._id && doc?.matriculatedSubjectId) {
    await createEvaluationNotification(doc._id, doc.matriculatedSubjectId, action);
  }
  await updateSyncNotification(this.model);
});

EvaluationScoreSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await deleteEvaluationNotifications(doc._id);
    await updateSyncNotification(this.model);
  }
});

EvaluationScoreSchema.post('deleteOne', { document: true, query: false }, async function () {
  await deleteEvaluationNotifications(this._id);
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
