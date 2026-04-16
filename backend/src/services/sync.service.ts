import {
    EvaluationScoreModel,
    PendingDeletionModel
} from '../models/system/index.js';
import {
    EvaluationModel,
    StudentModel,
    MatriculatedSubjectModel,
    EvaluationValueModel,
    ExaminationTypeModel,
    CareerModel
} from '../models/sigenu/index.js';
import { DatabaseService } from './database.service.js';
import crypto from 'crypto';

export const SyncService = {
    async syncPendingGrades() {
        console.log('Starting synchronization of pending grades to SIGENU (Postgres)...');

        const pendingDeletions = await PendingDeletionModel.find({ targetModel: 'EvaluationScore' });
        console.log(`Found ${pendingDeletions.length} pending deletions.`);

        let deletedCount = 0;
        let deleteErrors = 0;

        for (const deletion of pendingDeletions) {
            try {
                const deleteSql = 'DELETE FROM public.evaluation WHERE id_evaluation = $1';
                await DatabaseService.execute(deleteSql, [deletion.sigenId]);

                await EvaluationModel.deleteOne({ sigenId: deletion.sigenId });

                await PendingDeletionModel.findByIdAndDelete(deletion._id);
                deletedCount++;
            } catch (err) {
                console.error(`Error deleting evaluation ${deletion.sigenId} from SIGENU:`, err);
                deleteErrors++;
            }
        }

        const pendingScores = await EvaluationScoreModel.find({
            category: 'FINAL_EVALUATION',
            $or: [
                    { registrationDate: null },
                    {
                        $and: [
                            { registrationDate: { $ne: null } },
                            {
                                $expr: {
                                    $gt: ["$updatedAt", { $add: ["$registrationDate", 10000] }]
                                }
                            }
                        ]
                    }
                ]
        }).populate('studentId matriculatedSubjectId evaluationValueId examinationTypeId');

        console.log(`Found ${pendingScores.length} pending evaluations to sync.`);

        let processedCount = 0;
        let errorCount = 0;

        for (const score of pendingScores) {
            console.log(`Processing evaluation ${score._id}: registrationDate=${score.registrationDate}, updatedAt=${score.updatedAt}`);

            try {
                const student = await StudentModel.findById(score.studentId);
                const matriculated = await MatriculatedSubjectModel.findById(score.matriculatedSubjectId);
                const value = await EvaluationValueModel.findById(score.evaluationValueId);
                const type = await ExaminationTypeModel.findById(score.examinationTypeId);

                if (!student?.sigenId || !matriculated?.sigenId || !value?.sigenId || !type?.sigenId) {
                    console.error(`Missing Sigen ID references for EvaluationScoreModel ${score._id}`);
                    errorCount++;
                    continue;
                }

                const sigenEvaluationId: string | null = score.sigenId || null;

                const now = new Date();

                let finalId = sigenEvaluationId;
                if (finalId) {
                    const updateSql = `
                        UPDATE public.evaluation
                        SET evaluation_value_fk = $1, evaluation_date = $2, registration_date = $3
                        WHERE id_evaluation = $4
                    `;
                    await DatabaseService.execute(updateSql, [
                        value.sigenId,
                        score.evaluationDate,
                        now,
                        finalId
                    ]);
                } else {
                    finalId = crypto.randomUUID();
                    const insertSql = `
                        INSERT INTO public.evaluation 
                        (id_evaluation, student_fk, matriculated_subject_fk, evaluation_value_fk, examination_type_fk, evaluation_date, registration_date) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7) 
                    `;
                    await DatabaseService.execute(insertSql, [
                        finalId,
                        student.sigenId,
                        matriculated.sigenId,
                        value.sigenId,
                        type.sigenId,
                        score.evaluationDate,
                        now
                    ]);
                }

                score.registrationDate = now;
                score.sigenId = finalId;

                console.log(`Updating registrationDate for evaluation ${score._id}:`, {
                    registrationDate: now,
                    sigenId: finalId,
                    isModifiedBefore: score.isModified()
                });

                await EvaluationScoreModel.findByIdAndUpdate(score._id, {
                    registrationDate: now,
                    sigenId: finalId
                });

                console.log(`Successfully updated evaluation ${score._id}:`, {
                    registrationDate: now,
                    sigenId: finalId
                });

                await EvaluationModel.findOneAndUpdate(
                    { sigenId: finalId },
                    {
                        sigenId: finalId,
                        studentId: student._id,
                        matriculatedSubjectId: matriculated._id,
                        evaluationValueId: value._id,
                        examinationTypeId: type._id,
                        evaluationDate: score.evaluationDate,
                        registrationDate: now
                    },
                    { upsert: true, new: true }
                );

                processedCount++;

            } catch (err) {
                console.error(`Error processing EvaluationScoreModel ${score._id}:`, err);
                errorCount++;
                score.registrationDate = new Date();
            } finally {
                console.log(`Finally block for evaluation ${score._id}:`, {
                    registrationDate: score.registrationDate,
                    isModified: score.isModified()
                });
                if (score.isModified()) {
                    await score.save();
                }
            }
        }

        console.log(`Sync completed. Processed: ${processedCount}, Errors: ${errorCount}, Deleted: ${deletedCount}`);

        const afterSync = await EvaluationScoreModel.find({
            category: 'FINAL_EVALUATION',
            $or: [
                { registrationDate: null },
                { $expr: { $gt: ["$updatedAt", "$registrationDate"] } }
            ]
        }).countDocuments();
        console.log(`Pending evaluations after sync: ${afterSync}`);

        const backupFile = await DatabaseService.createBackup();
        return { backupFile, processedCount, errorCount, deletedCount };
    },

    async getPendingGradesCount() {
        try {
            const count = await EvaluationScoreModel.countDocuments({
                category: 'FINAL_EVALUATION',
                $or: [
                    { registrationDate: null },

                    {
                        $and: [
                            { registrationDate: { $ne: null } },
                            {
                                $expr: {

                                    $gt: ["$updatedAt", { $add: ["$registrationDate", 10000] }]
                                }
                            }
                        ]
                    }
                ]
            });
            return count;
        } catch (error) {
            console.error('Error in getPendingGradesCount:', error);
            throw error;
        }
    },

    async getLastExportStats() {
        const lastExport = await EvaluationScoreModel.findOne({
            category: 'FINAL_EVALUATION',
            registrationDate: { $ne: null }
        }).sort({ registrationDate: -1 });

        if (!lastExport || !lastExport.registrationDate) {
            return { count: 0, date: null };
        }

        const lastDate = new Date(lastExport.registrationDate);
        const startWindow = new Date(lastDate.getTime() - 60000);
        const endWindow = new Date(lastDate.getTime() + 60000);

        const count = await EvaluationScoreModel.countDocuments({
            category: 'FINAL_EVALUATION',
            registrationDate: {
                $gte: startWindow,
                $lte: endWindow
            }
        });

        return { count, date: lastExport.registrationDate };
    },

    async getPendingGrades(skip: number = 0, limit: number = 50) {
        try {
            const evaluations = await EvaluationScoreModel.find({
                category: 'FINAL_EVALUATION',
                $or: [
                    { registrationDate: null },
                    {
                        $and: [
                            { registrationDate: { $ne: null } }, 
                            {
                                $expr: {
                                    $gt: ["$updatedAt", { $add: ["$registrationDate", 10000] }]
                                }
                            }
                        ]
                    }
                ]
            })
                .populate({
                    path: 'studentId',
                    populate: {
                        path: 'careerId',
                        select: 'name' 
                    }
                })
                .populate({
                    path: 'matriculatedSubjectId',
                    populate: { path: 'subjectId', select: 'name' }
                })
                .populate('evaluationValueId', 'value')
                .populate('examinationTypeId', 'name')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(); 

            return evaluations;
        } catch (error) {
            console.error('Error in getPendingGrades:', error);
            throw error;
        }
    },

    async getLastExportGradesCount() {
        try {
            const lastExport = await EvaluationScoreModel.findOne({
                category: 'FINAL_EVALUATION',
                registrationDate: { $ne: null }
            }).sort({ registrationDate: -1 });

            if (!lastExport || !lastExport.registrationDate) {
                return { count: 0 };
            }

            const lastDate = new Date(lastExport.registrationDate);
            const startWindow = new Date(lastDate.getTime() - 60000);
            const endWindow = new Date(lastDate.getTime() + 60000);

            const count = await EvaluationScoreModel.countDocuments({
                category: 'FINAL_EVALUATION',
                registrationDate: {
                    $gte: startWindow,
                    $lte: endWindow
                }
            });

            return { count, date: lastExport.registrationDate };
        } catch (error) {
            console.error('Error in getLastExportGradesCount:', error);
            throw error;
        }
    },

    async getLastExportGrades(skip: number = 0, limit: number = 50) {
        const lastExport = await EvaluationScoreModel.findOne({
            category: 'FINAL_EVALUATION',
            registrationDate: { $ne: null }
        }).sort({ registrationDate: -1 });

        if (!lastExport || !lastExport.registrationDate) {
            return [];
        }

        const lastDate = new Date(lastExport.registrationDate);
        const startWindow = new Date(lastDate.getTime() - 60000);
        const endWindow = new Date(lastDate.getTime() + 60000);

        return await EvaluationScoreModel.find({
            category: 'FINAL_EVALUATION',
            registrationDate: {
                $gte: startWindow,
                $lte: endWindow
            }
        })
            .populate({
                path: 'studentId',
                populate: {
                    path: 'careerId',
                    model: 'Career'
                }
            })
            .populate({
                path: 'matriculatedSubjectId',
                populate: { path: 'subjectId', select: 'name' }
            })
            .populate('evaluationValueId', 'value')
            .populate('examinationTypeId', 'name')
            .sort({ registrationDate: -1 })
            .skip(skip)
            .limit(limit);
    }
};
