import { Request, Response } from 'express';
import {
    EvaluationModel,
    EvaluationValueModel,
    ExaminationTypeModel,
    MatriculatedSubjectModel,
    StudentModel,
    SubjectModel
} from '../models/sigenu/index.js';
import {
    AttendanceModel,
    EvaluationCategory,
    EvaluationScoreModel
} from '../models/system/index.js';

const toNumericScore = (value: unknown) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 2;
    const normalized = value.trim().toUpperCase();
    if (normalized === 'NP') return 2;
    if (normalized === 'CO') return 5;

    const match = value.match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return 2;
    const parsed = Number.parseFloat(match[0].replace(',', '.'));
    return Number.isFinite(parsed) ? Math.max(2, Math.min(5, parsed)) : 2;
};

const average = (values: number[]) => {
    if (!values.length) return 2;
    const total = values.reduce((sum, current) => sum + current, 0);
    return total / values.length;
};

export async function getSubjectEvaluationHistory(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const subjectId = req.query.subjectId as string | undefined;
        if (!professorId) return res.status(401).json({ message: 'Usuario no autenticado' });
        if (!subjectId) return res.status(400).json({ message: 'subjectId es requerido' });

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId }).select('_id').lean();
        if (!subject) return res.status(404).json({ message: 'Asignatura no encontrada' });

        const matriculatedSubjects = await MatriculatedSubjectModel.find({ subjectId }).select('_id').lean();
        const matriculatedIds = matriculatedSubjects.map((m) => m._id);

        const evaluations = await EvaluationScoreModel.find({
            matriculatedSubjectId: { $in: matriculatedIds }
        })
            .populate('evaluationValueId', 'value')
            .populate('examinationTypeId', 'name')
            .sort({ createdAt: -1 })
            .lean();

        // Group by createdAt
        const groupedMap = new Map<string, any>();
        evaluations.forEach((evaluation: any) => {
            const createdAtStr = evaluation.createdAt.toISOString();
            if (!groupedMap.has(createdAtStr)) {
                groupedMap.set(createdAtStr, {
                    createdAt: evaluation.createdAt,
                    category: evaluation.category,
                    examinationType: evaluation.examinationTypeId?.name || '',
                    evaluationDate: evaluation.evaluationDate,
                    description: evaluation.description,
                    scores: []
                });
            }
            const numericValue = toNumericScore(evaluation.evaluationValueId?.value);
            groupedMap.get(createdAtStr).scores.push(numericValue);
        });

        const data = Array.from(groupedMap.values()).map(group => ({
            ...group,
            evaluationAverage: Number(average(group.scores).toFixed(2))
        }));

        return res.status(200).json({ data });
    } catch (error: any) {
        console.error('Error in getSubjectEvaluationHistory:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get subject evaluation history.'
        });
    }
}

export async function getSubjectEvaluationBatchDetail(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const subjectId = req.query.subjectId as string | undefined;
        const createdAt = req.query.createdAt as string | undefined;

        if (!professorId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        if (!subjectId || !createdAt) {
            return res.status(400).json({ message: 'subjectId y createdAt son requeridos' });
        }

        const parsedCreatedAt = new Date(createdAt);
        if (Number.isNaN(parsedCreatedAt.getTime())) {
            return res.status(400).json({ message: 'createdAt no tiene un formato válido' });
        }

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId })
            .select('_id')
            .lean();

        if (!subject) {
            return res.status(404).json({ message: 'Asignatura no encontrada' });
        }

        const matriculatedSubjects = await MatriculatedSubjectModel.find({ subjectId })
            .select('_id')
            .lean();
        const matriculatedIds = matriculatedSubjects.map((item) => item._id);

        const evaluations = await EvaluationScoreModel.find({
            matriculatedSubjectId: { $in: matriculatedIds },
            createdAt: parsedCreatedAt
        })
            .populate('studentId', 'firstName lastName')
            .populate('evaluationValueId', 'value')
            .populate('examinationTypeId', 'name')
            .sort({ studentId: 1 })
            .lean();

        if (evaluations.length === 0) {
            return res.status(404).json({ message: 'No se encontraron registros para esta evaluación' });
        }

        const firstEvaluation = evaluations[0] as any;
        const scores = evaluations.map((item: any) => toNumericScore(item.evaluationValueId?.value));

        const data = evaluations
            .map((item: any) => ({
                _id: String(item._id),
                studentId: String(item.studentId?._id || ''),
                studentName: `${item.studentId?.firstName || ''} ${item.studentId?.lastName || ''}`.trim() || 'Sin nombre',
                evaluationValue: item.evaluationValueId?.value || ''
            }))
            .sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));

        return res.status(200).json({
            batch: {
                createdAt: firstEvaluation.createdAt,
                category: firstEvaluation.category,
                examinationType: firstEvaluation.examinationTypeId?.name || '',
                evaluationDate: firstEvaluation.evaluationDate,
                description: firstEvaluation.description || '',
                evaluationAverage: Number(average(scores).toFixed(2)),
                subjectName: subject.name || ''
            },
            data,
            totalCount: data.length
        });
    } catch (error: any) {
        console.error('Error in getSubjectEvaluationBatchDetail:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get subject evaluation batch detail.'
        });
    }
}

export async function getSubjectAttendanceHistory(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const subjectId = req.query.subjectId as string | undefined;
        if (!professorId) return res.status(401).json({ message: 'Usuario no autenticado' });
        if (!subjectId) return res.status(400).json({ message: 'subjectId es requerido' });

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId }).select('_id').lean();
        if (!subject) return res.status(404).json({ message: 'Asignatura no encontrada' });

        const attendances = await AttendanceModel.find({ subjectId })
            .sort({ createdAt: -1 })
            .lean();

        // Group by createdAt
        const groupedMap = new Map<string, any>();
        attendances.forEach((attendance: any) => {
            const createdAtStr = attendance.createdAt.toISOString();
            if (!groupedMap.has(createdAtStr)) {
                groupedMap.set(createdAtStr, {
                    createdAt: attendance.createdAt,
                    attendanceDate: attendance.attendanceDate,
                    presentCount: 0,
                    totalCount: 0
                });
            }
            const group = groupedMap.get(createdAtStr);
            group.totalCount++;
            if (attendance.isPresent) group.presentCount++;
        });

        const data = Array.from(groupedMap.values()).map(group => ({
            ...group,
            averageAttendance: group.totalCount > 0 ? Number(((group.presentCount / group.totalCount) * 100).toFixed(2)) : 0
        }));

        return res.status(200).json({ data });
    } catch (error: any) {
        console.error('Error in getSubjectAttendanceHistory:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get subject attendance history.'
        });
    }
}

export async function getSubjectAttendanceBatchDetail(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const subjectId = req.query.subjectId as string | undefined;
        const createdAt = req.query.createdAt as string | undefined;

        if (!professorId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        if (!subjectId || !createdAt) {
            return res.status(400).json({ message: 'subjectId y createdAt son requeridos' });
        }

        const parsedCreatedAt = new Date(createdAt);
        if (Number.isNaN(parsedCreatedAt.getTime())) {
            return res.status(400).json({ message: 'createdAt no tiene un formato válido' });
        }

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId })
            .select('_id name')
            .lean();

        if (!subject) {
            return res.status(404).json({ message: 'Asignatura no encontrada' });
        }

        const attendances = await AttendanceModel.find({
            subjectId,
            createdAt: parsedCreatedAt
        })
            .populate('studentId', 'firstName lastName')
            .sort({ studentId: 1 })
            .lean();

        if (attendances.length === 0) {
            return res.status(404).json({ message: 'No se encontraron registros para esta asistencia' });
        }

        const firstAttendance = attendances[0] as any;
        const presentCount = attendances.filter((item: any) => item.isPresent).length;

        const data = attendances
            .map((item: any) => ({
                _id: String(item._id),
                studentId: String(item.studentId?._id || ''),
                studentName: `${item.studentId?.firstName || ''} ${item.studentId?.lastName || ''}`.trim() || 'Sin nombre',
                isPresent: Boolean(item.isPresent),
                justified: Boolean(item.justified),
                justificationReason: item.justificationReason || ''
            }))
            .sort((a, b) => a.studentName.localeCompare(b.studentName, 'es'));

        return res.status(200).json({
            batch: {
                createdAt: firstAttendance.createdAt,
                attendanceDate: firstAttendance.attendanceDate,
                averageAttendance: Number(((presentCount / attendances.length) * 100).toFixed(2)),
                subjectName: subject.name || ''
            },
            data,
            totalCount: data.length
        });
    } catch (error: any) {
        console.error('Error in getSubjectAttendanceBatchDetail:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get subject attendance batch detail.'
        });
    }
}

export async function deleteSubjectEvaluationBatch(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const { subjectId, createdAt } = req.body;
        if (!professorId) return res.status(401).json({ message: 'Usuario no autenticado' });
        if (!subjectId || !createdAt) return res.status(400).json({ message: 'subjectId y createdAt son requeridos' });

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId }).select('_id').lean();
        if (!subject) return res.status(404).json({ message: 'Asignatura no encontrada' });

        const matriculatedSubjects = await MatriculatedSubjectModel.find({ subjectId }).select('_id').lean();
        const matriculatedIds = matriculatedSubjects.map((m) => m._id);

        const deleteResult = await EvaluationScoreModel.deleteMany({
            matriculatedSubjectId: { $in: matriculatedIds },
            createdAt: new Date(createdAt)
        });

        return res.status(200).json({
            success: true,
            message: `${deleteResult.deletedCount} registros de evaluación eliminados correctamente.`,
            deletedCount: deleteResult.deletedCount
        });
    } catch (error: any) {
        console.error('Error in deleteSubjectEvaluationBatch:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete evaluation batch.'
        });
    }
}

export async function deleteSubjectAttendanceBatch(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const { subjectId, createdAt } = req.body;
        if (!professorId) return res.status(401).json({ message: 'Usuario no autenticado' });
        if (!subjectId || !createdAt) return res.status(400).json({ message: 'subjectId y createdAt son requeridos' });

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId }).select('_id').lean();
        if (!subject) return res.status(404).json({ message: 'Asignatura no encontrada' });

        const deleteResult = await AttendanceModel.deleteMany({
            subjectId,
            createdAt: new Date(createdAt)
        });

        return res.status(200).json({
            success: true,
            message: `${deleteResult.deletedCount} registros de asistencia eliminados correctamente.`,
            deletedCount: deleteResult.deletedCount
        });
    } catch (error: any) {
        console.error('Error in deleteSubjectAttendanceBatch:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete attendance batch.'
        });
    }
}


export async function getProfessorSubjects(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        if (!professorId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        const filter = { professorId };

        const [subjects, totalCount] = await Promise.all([
            SubjectModel.find(filter)
                .populate('careerId', 'name')
                .sort({ academicYear: 1, name: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            SubjectModel.countDocuments(filter)
        ]);

        return res.status(200).json({
            data: subjects,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getProfessorSubjects:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get professor subjects.'
        });
    }
}

type EvaluationRowForAverage = {
    matriculatedSubjectId: unknown;
    category: EvaluationCategory;
    evaluationValueId?: { value?: string } | null;
};

const getSubjectStudentKey = (subjectId: string, studentId: string) => `${subjectId}:${studentId}`;

const calculateSubjectEvaluationAverageForStudent = (
    subjectId: string,
    studentId: string,
    matriculatedIdsBySubjectStudent: Map<string, string[]>,
    evaluationRowsByMatriculated: Map<string, EvaluationRowForAverage[]>
) => {
    const key = getSubjectStudentKey(subjectId, studentId);
    const matriculatedIds = matriculatedIdsBySubjectStudent.get(key) || [];
    if (matriculatedIds.length === 0) return 2;

    const systematic: number[] = [];
    const partial: number[] = [];
    const final: number[] = [];

    matriculatedIds.forEach((matriculatedId) => {
        const rows = evaluationRowsByMatriculated.get(matriculatedId) || [];
        rows.forEach((evaluation) => {
            const numericValue = toNumericScore(evaluation.evaluationValueId?.value);
            if (evaluation.category === EvaluationCategory.SYSTEMATIC_EVALUATION) {
                systematic.push(numericValue);
            } else if (evaluation.category === EvaluationCategory.PARTIAL_EVALUATION) {
                partial.push(numericValue);
            } else if (evaluation.category === EvaluationCategory.FINAL_EVALUATION) {
                final.push(numericValue);
            }
        });
    });

    const weights = {
        systematic: 0.2,
        partial: 0.3,
        final: 0.5
    };

    const sAvg = systematic.length > 0 ? average(systematic) : null;
    const pAvg = partial.length > 0 ? average(partial) : null;
    const fScore = final.length > 0 ? Math.max(...final) : null;

    let totalWeightUsed = 0;
    let weightedSum = 0;

    if (sAvg !== null) {
        weightedSum += sAvg * weights.systematic;
        totalWeightUsed += weights.systematic;
    }
    if (pAvg !== null) {
        weightedSum += pAvg * weights.partial;
        totalWeightUsed += weights.partial;
    }
    if (fScore !== null) {
        weightedSum += fScore * weights.final;
        totalWeightUsed += weights.final;
    }

    if (totalWeightUsed === 0) return 2;

    const finalResult = weightedSum / totalWeightUsed;

    return Math.max(2, Math.min(5, Number(finalResult.toFixed(2))));
};

const hasEvaluationsForSubjectStudent = (
    subjectId: string,
    studentId: string,
    matriculatedIdsBySubjectStudent: Map<string, string[]>,
    evaluationRowsByMatriculated: Map<string, EvaluationRowForAverage[]>
) => {
    const key = getSubjectStudentKey(subjectId, studentId);
    const matriculatedIds = matriculatedIdsBySubjectStudent.get(key) || [];
    return matriculatedIds.some((matriculatedId) => (evaluationRowsByMatriculated.get(matriculatedId) || []).length > 0);
};

const getDayRange = (dateValue?: string) => {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return null;
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

export async function getSubjectStudentsSummary(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const subjectId = req.query.subjectId as string | undefined;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        if (!professorId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        if (!subjectId) {
            return res.status(400).json({ message: 'subjectId es requerido' });
        }

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId })
            .select('_id name academicYear careerId')
            .populate('careerId', 'name')
            .lean();

        if (!subject) {
            return res.status(404).json({ message: 'Asignatura no encontrada para el profesor autenticado' });
        }

        const subjectCareerId = typeof subject.careerId === 'object' && subject.careerId
            ? String((subject.careerId as { _id?: unknown })._id || '')
            : String(subject.careerId || '');

        const validStudents = await StudentModel.find({
            careerId: subjectCareerId,
            academicYear: subject.academicYear
        })
            .select('_id')
            .lean();

        const validStudentIds = validStudents.map((student) => student._id);
        const enrollmentFilter = {
            subjectId,
            studentId: { $in: validStudentIds },
            academicYear: subject.academicYear
        };

        const [matriculatedSubjects, totalCount] = await Promise.all([
            MatriculatedSubjectModel.find(enrollmentFilter)
                .populate('studentId', 'firstName lastName')
                .sort({ academicYear: 1, _id: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            MatriculatedSubjectModel.countDocuments(enrollmentFilter)
        ]);

        const matriculatedIds = matriculatedSubjects.map((item) => item._id);
        const studentIds = matriculatedSubjects.map((item) => item.studentId?._id).filter(Boolean);

        const [attendanceRows, evaluationRows] = await Promise.all([
            AttendanceModel.aggregate([
                {
                    $match: {
                        subjectId: subject._id,
                        studentId: { $in: studentIds }
                    }
                },
                {
                    $group: {
                        _id: '$studentId',
                        total: { $sum: 1 },
                        present: {
                            $sum: {
                                $cond: [{ $eq: ['$isPresent', true] }, 1, 0]
                            }
                        }
                    }
                }
            ]),
            EvaluationScoreModel.find({
                matriculatedSubjectId: { $in: matriculatedIds }
            })
                .populate('evaluationValueId', 'value')
                .select('matriculatedSubjectId category evaluationValueId')
                .lean()
        ]);

        const attendanceMap = new Map<string, { total: number; present: number }>();
        attendanceRows.forEach((row) => {
            attendanceMap.set(String(row._id), {
                total: row.total,
                present: row.present
            });
        });

        const matriculatedIdsBySubjectStudent = new Map<string, string[]>();
        matriculatedSubjects.forEach((item) => {
            const studentRecord = item.studentId as unknown as Record<string, unknown> | null;
            const studentIdValue = studentRecord && typeof studentRecord === 'object' && '_id' in studentRecord
                ? studentRecord._id
                : item.studentId;
            const studentKey = studentIdValue ? String(studentIdValue) : '';
            if (!studentKey) return;
            const key = getSubjectStudentKey(subjectId, studentKey);
            const current = matriculatedIdsBySubjectStudent.get(key) || [];
            current.push(String(item._id));
            matriculatedIdsBySubjectStudent.set(key, current);
        });

        const evaluationRowsByMatriculated = new Map<string, EvaluationRowForAverage[]>();
        evaluationRows.forEach((evaluation) => {
            const key = String(evaluation.matriculatedSubjectId);
            const current = evaluationRowsByMatriculated.get(key) || [];
            current.push(evaluation as unknown as EvaluationRowForAverage);
            evaluationRowsByMatriculated.set(key, current);
        });

        const data = matriculatedSubjects.map((item) => {
            const studentRecord = item.studentId as unknown as Record<string, unknown> | null;
            const studentIdValue = studentRecord && typeof studentRecord === 'object' && '_id' in studentRecord
                ? studentRecord._id
                : item.studentId;
            const studentKey = studentIdValue ? String(studentIdValue) : '';
            const attendance = attendanceMap.get(studentKey);
            const attendanceAverage = attendance && attendance.total > 0
                ? (attendance.present / attendance.total) * 100
                : 0;

            const evaluationAverage = studentKey
                ? calculateSubjectEvaluationAverageForStudent(
                    subjectId,
                    studentKey,
                    matriculatedIdsBySubjectStudent,
                    evaluationRowsByMatriculated
                )
                : 0;

            return {
                _id: String(item._id),
                studentId: studentIdValue ? String(studentIdValue) : null,
                studentName: `${(studentRecord?.firstName as string) || ''} ${(studentRecord?.lastName as string) || ''}`.trim() || 'Sin nombre',
                attendanceAverage: Number(attendanceAverage.toFixed(2)),
                evaluationAverage,
                academicYear: item.academicYear
            };
        });

        return res.status(200).json({
            subject: {
                _id: String(subject._id),
                name: subject.name,
                academicYear: subject.academicYear,
                careerName: typeof subject.careerId === 'object' && subject.careerId
                    ? (subject.careerId as { name?: string }).name || 'Sin carrera'
                    : 'Sin carrera'
            },
            data,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getSubjectStudentsSummary:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get subject students summary.'
        });
    }
}

export async function getStudentEvaluationRecords(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const subjectId = req.query.subjectId as string | undefined;
        const studentId = req.query.studentId as string | undefined;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        if (!professorId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        if (!subjectId || !studentId) {
            return res.status(400).json({ message: 'subjectId y studentId son requeridos' });
        }

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId })
            .select('_id')
            .lean();

        if (!subject) {
            return res.status(404).json({ message: 'Asignatura no encontrada para el profesor autenticado' });
        }

        const matriculatedSubjects = await MatriculatedSubjectModel.find({ subjectId, studentId })
            .select('_id')
            .lean();

        const matriculatedIds = matriculatedSubjects.map((item) => item._id);
        if (matriculatedIds.length === 0) {
            return res.status(200).json({
                data: [],
                totalCount: 0,
                page,
                limit
            });
        }

        const filter = {
            studentId,
            matriculatedSubjectId: { $in: matriculatedIds }
        };

        const [rows, totalCount] = await Promise.all([
            EvaluationScoreModel.find(filter)
                .populate('evaluationValueId', 'value')
                .populate('examinationTypeId', 'name')
                .sort({ evaluationDate: -1, updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            EvaluationScoreModel.countDocuments(filter)
        ]);

        return res.status(200).json({
            data: rows,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getStudentEvaluationRecords:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get student evaluation records.'
        });
    }
}

export async function getStudentAttendanceRecords(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const subjectId = req.query.subjectId as string | undefined;
        const studentId = req.query.studentId as string | undefined;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        if (!professorId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        if (!subjectId || !studentId) {
            return res.status(400).json({ message: 'subjectId y studentId son requeridos' });
        }

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId })
            .select('_id')
            .lean();

        if (!subject) {
            return res.status(404).json({ message: 'Asignatura no encontrada para el profesor autenticado' });
        }

        const filter = { subjectId, studentId };
        const [rows, totalCount] = await Promise.all([
            AttendanceModel.find(filter)
                .sort({ attendanceDate: -1, updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            AttendanceModel.countDocuments(filter)
        ]);

        return res.status(200).json({
            data: rows,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getStudentAttendanceRecords:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get student attendance records.'
        });
    }
}

export async function getAcademicRanking(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const subjectId = req.query.subjectId as string | undefined;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;

        if (!professorId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        if (!subjectId) {
            return res.status(400).json({ message: 'subjectId es requerido' });
        }

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId })
            .select('_id name academicYear careerId')
            .populate('careerId', 'name')
            .lean();

        if (!subject) {
            return res.status(404).json({ message: 'Asignatura no encontrada para el profesor autenticado' });
        }

        const subjectCareerId = typeof subject.careerId === 'object' && subject.careerId
            ? String((subject.careerId as { _id?: unknown })._id || '')
            : String(subject.careerId || '');

        const validStudents = await StudentModel.find({
            careerId: subjectCareerId,
            academicYear: subject.academicYear
        })
            .select('_id')
            .lean();

        const validStudentIds = validStudents.map((student) => student._id);
        const currentSubjectEnrollments = await MatriculatedSubjectModel.find({
            subjectId,
            studentId: { $in: validStudentIds },
            academicYear: subject.academicYear
        })
            .populate('studentId', 'firstName lastName')
            .sort({ _id: 1 })
            .lean();

        const totalCount = currentSubjectEnrollments.length;
        if (totalCount === 0) {
            return res.status(200).json({
                subject: {
                    _id: String(subject._id),
                    name: subject.name,
                    academicYear: subject.academicYear,
                    careerName: typeof subject.careerId === 'object' && subject.careerId
                        ? (subject.careerId as { name?: string }).name || 'Sin carrera'
                        : 'Sin carrera'
                },
                data: [],
                totalCount: 0,
                page,
                limit
            });
        }

        const enrolledStudentIds = currentSubjectEnrollments
            .map((item) => {
                const studentRecord = item.studentId as unknown as Record<string, unknown> | null;
                return studentRecord?._id ? String(studentRecord._id) : '';
            })
            .filter(Boolean);

        const allMatriculatedForStudents = await MatriculatedSubjectModel.find({
            studentId: { $in: enrolledStudentIds }
        })
            .select('_id subjectId studentId')
            .lean();

        const allMatriculatedIds = allMatriculatedForStudents.map((item) => item._id);
        const [evaluationScoreRows, legacyEvaluationRows] = await Promise.all([
            EvaluationScoreModel.find({
                matriculatedSubjectId: { $in: allMatriculatedIds }
            })
                .populate('evaluationValueId', 'value')
                .select('matriculatedSubjectId category evaluationValueId')
                .lean(),
            EvaluationModel.find({
                matriculatedSubjectId: { $in: allMatriculatedIds }
            })
                .populate('evaluationValueId', 'value')
                .select('matriculatedSubjectId evaluationValueId')
                .lean()
        ]);



        const matriculatedIdsBySubjectStudent = new Map<string, string[]>();
        const subjectIdsByStudent = new Map<string, Set<string>>();

        allMatriculatedForStudents.forEach((item) => {
            const studentKey = String(item.studentId);
            const itemSubjectId = String(item.subjectId);
            const key = getSubjectStudentKey(itemSubjectId, studentKey);
            const current = matriculatedIdsBySubjectStudent.get(key) || [];
            current.push(String(item._id));
            matriculatedIdsBySubjectStudent.set(key, current);

            const studentSubjects = subjectIdsByStudent.get(studentKey) || new Set<string>();
            studentSubjects.add(itemSubjectId);
            subjectIdsByStudent.set(studentKey, studentSubjects);
        });

        //
        const studentNameById = new Map<string, string>();
        currentSubjectEnrollments.forEach((item) => {
            const studentRecord = item.studentId as unknown as Record<string, unknown> | null;
            const studentIdValue = studentRecord?._id ? String(studentRecord._id) : '';
            if (!studentIdValue) return;
            const studentName = `${(studentRecord?.firstName as string) || ''} ${(studentRecord?.lastName as string) || ''}`.trim() || 'Sin nombre';
            studentNameById.set(studentIdValue, studentName);
        });

        const studentIdByMatriculatedId = new Map<string, string>();
        const subjectIdByMatriculatedId = new Map<string, string>();
        allMatriculatedForStudents.forEach((item) => {
            studentIdByMatriculatedId.set(String(item._id), String(item.studentId));
            subjectIdByMatriculatedId.set(String(item._id), String(item.subjectId));
        });

        const uniqueSubjectIds = Array.from(new Set(
            allMatriculatedForStudents.map((item) => String(item.subjectId))
        ));
        const subjectsForLog = await SubjectModel.find({ _id: { $in: uniqueSubjectIds } })
            .select('_id name')
            .lean();
        const subjectNameById = new Map<string, string>();
        subjectsForLog.forEach((item) => {
            subjectNameById.set(String(item._id), item.name || 'Sin asignatura');
        });

        //
        const evaluationRowsByMatriculated = new Map<string, EvaluationRowForAverage[]>();
        evaluationScoreRows.forEach((evaluation) => {
            const key = String(evaluation.matriculatedSubjectId);
            const current = evaluationRowsByMatriculated.get(key) || [];
            current.push(evaluation as unknown as EvaluationRowForAverage);
            evaluationRowsByMatriculated.set(key, current);
        });

        legacyEvaluationRows.forEach((evaluation) => {
            const key = String(evaluation.matriculatedSubjectId);
            const current = evaluationRowsByMatriculated.get(key) || [];
            const hasFinalFromScore = current.some(
                (row) => row.category === EvaluationCategory.FINAL_EVALUATION
            );
            if (hasFinalFromScore) return;

            current.push({
                matriculatedSubjectId: evaluation.matriculatedSubjectId,
                category: EvaluationCategory.FINAL_EVALUATION,
                evaluationValueId: evaluation.evaluationValueId as { value?: string } | null
            });
            evaluationRowsByMatriculated.set(key, current);
        });

        const rankingRows = currentSubjectEnrollments.map((item) => {
            const studentRecord = item.studentId as unknown as Record<string, unknown> | null;
            const studentIdValue = studentRecord?._id ? String(studentRecord._id) : '';
            const studentName = `${(studentRecord?.firstName as string) || ''} ${(studentRecord?.lastName as string) || ''}`.trim() || 'Sin nombre';

            const subjectAverage = calculateSubjectEvaluationAverageForStudent(
                subjectId,
                studentIdValue,
                matriculatedIdsBySubjectStudent,
                evaluationRowsByMatriculated
            );

            const studentSubjectIds = Array.from(subjectIdsByStudent.get(studentIdValue) || []);
            const subjectAverages = studentSubjectIds
                .filter((itemSubjectId) => hasEvaluationsForSubjectStudent(
                    itemSubjectId,
                    studentIdValue,
                    matriculatedIdsBySubjectStudent,
                    evaluationRowsByMatriculated
                ))
                .map((itemSubjectId) => calculateSubjectEvaluationAverageForStudent(
                    itemSubjectId,
                    studentIdValue,
                    matriculatedIdsBySubjectStudent,
                    evaluationRowsByMatriculated
                ));

            const generalAverage = subjectAverages.length > 0
                ? Number(average(subjectAverages).toFixed(2))
                : 2;

            return {
                _id: studentIdValue,
                studentId: studentIdValue,
                studentName,
                subjectEvaluationAverage: subjectAverage,
                generalAverage
            };
        });

        rankingRows.sort((a, b) => {
            if (b.generalAverage !== a.generalAverage) return b.generalAverage - a.generalAverage;
            if (b.subjectEvaluationAverage !== a.subjectEvaluationAverage) return b.subjectEvaluationAverage - a.subjectEvaluationAverage;
            return a.studentName.localeCompare(b.studentName, 'es');
        });

        const start = page * limit;
        const end = start + limit;
        const data = rankingRows.slice(start, end);

        return res.status(200).json({
            subject: {
                _id: String(subject._id),
                name: subject.name,
                academicYear: subject.academicYear,
                careerName: typeof subject.careerId === 'object' && subject.careerId
                    ? (subject.careerId as { name?: string }).name || 'Sin carrera'
                    : 'Sin carrera'
            },
            data,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getAcademicRanking:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get academic ranking.'
        });
    }
}

export async function getSubjectEvaluationRegisterData(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const subjectId = req.query.subjectId as string | undefined;
        const category = req.query.category as EvaluationCategory | undefined;
        const examinationTypeId = req.query.examinationTypeId as string | undefined;
        const description = req.query.description as string | undefined;
        const evaluationDate = req.query.evaluationDate as string | undefined;

        if (!professorId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        if (!subjectId) {
            return res.status(400).json({ message: 'subjectId es requerido' });
        }

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId })
            .select('_id name academicYear careerId')
            .populate('careerId', 'name')
            .lean();

        if (!subject) {
            return res.status(404).json({ message: 'Asignatura no encontrada para el profesor autenticado' });
        }

        const subjectCareerId = typeof subject.careerId === 'object' && subject.careerId
            ? String((subject.careerId as { _id?: unknown })._id || '')
            : String(subject.careerId || '');

        const validStudents = await StudentModel.find({
            careerId: subjectCareerId,
            academicYear: subject.academicYear
        })
            .select('_id')
            .lean();

        const validStudentIds = validStudents.map((student) => student._id);
        const matriculatedSubjects = await MatriculatedSubjectModel.find({
            subjectId,
            studentId: { $in: validStudentIds },
            academicYear: subject.academicYear
        })
            .populate('studentId', 'firstName lastName')
            .sort({ _id: 1 })
            .lean();

        const [evaluationValues, examinationTypes] = await Promise.all([
            EvaluationValueModel.find()
                .select('_id value')
                .sort({ value: 1 })
                .lean(),
            ExaminationTypeModel.find()
                .select('_id name priority')
                .sort({ priority: 1, name: 1 })
                .lean()
        ]);

        const matriculatedIds = matriculatedSubjects.map((item) => item._id);
        const evaluationFilter: Record<string, unknown> = {
            matriculatedSubjectId: { $in: matriculatedIds }
        };

        if (category) {
            evaluationFilter.category = category;
        }

        if (category === EvaluationCategory.FINAL_EVALUATION && examinationTypeId) {
            evaluationFilter.examinationTypeId = examinationTypeId;
        }

        if (description) {
            evaluationFilter.description = description.trim();
        }

        const dayRange = getDayRange(evaluationDate);
        if (dayRange) {
            evaluationFilter.evaluationDate = { $gte: dayRange.start, $lte: dayRange.end };
        }

        const evaluationRows = await EvaluationScoreModel.find(evaluationFilter)
            .select('_id studentId matriculatedSubjectId category evaluationValueId examinationTypeId description evaluationDate')
            .sort({ updatedAt: -1 })
            .lean();

        const evaluationMap = new Map<string, Record<string, unknown>>();
        evaluationRows.forEach((row) => {
            const key = String(row.matriculatedSubjectId);
            if (!evaluationMap.has(key)) {
                evaluationMap.set(key, row as unknown as Record<string, unknown>);
            }
        });

        const data = matriculatedSubjects.map((item) => {
            const studentRecord = item.studentId as unknown as Record<string, unknown> | null;
            const existingEvaluation = evaluationMap.get(String(item._id));
            return {
                matriculatedSubjectId: String(item._id),
                studentId: studentRecord?._id ? String(studentRecord._id) : '',
                studentName: `${(studentRecord?.firstName as string) || ''} ${(studentRecord?.lastName as string) || ''}`.trim() || 'Sin nombre',
                academicYear: item.academicYear,
                evaluation: existingEvaluation
                    ? {
                        _id: String(existingEvaluation._id || ''),
                        category: String(existingEvaluation.category || ''),
                        evaluationValueId: String(existingEvaluation.evaluationValueId || ''),
                        examinationTypeId: existingEvaluation.examinationTypeId
                            ? String(existingEvaluation.examinationTypeId)
                            : '',
                        description: String(existingEvaluation.description || ''),
                        evaluationDate: existingEvaluation.evaluationDate
                    }
                    : null
            };
        });

        return res.status(200).json({
            subject: {
                _id: String(subject._id),
                name: subject.name,
                academicYear: subject.academicYear,
                careerName: typeof subject.careerId === 'object' && subject.careerId
                    ? (subject.careerId as { name?: string }).name || 'Sin carrera'
                    : 'Sin carrera'
            },
            options: {
                categories: Object.values(EvaluationCategory),
                evaluationValues: evaluationValues.map((item) => ({
                    _id: String(item._id),
                    value: item.value
                })),
                examinationTypes: examinationTypes.map((item) => ({
                    _id: String(item._id),
                    name: item.name,
                    priority: item.priority
                }))
            },
            data,
            totalCount: data.length
        });
    } catch (error: any) {
        console.error('Error in getSubjectEvaluationRegisterData:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get evaluation register data.'
        });
    }
}

export async function upsertSubjectEvaluationRegister(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const {
            subjectId,
            category,
            evaluationDate,
            examinationTypeId,
            description,
            entries
        } = req.body as {
            subjectId?: string;
            category?: EvaluationCategory;
            evaluationDate?: string;
            examinationTypeId?: string;
            description?: string;
            entries?: Array<{
                evaluationId?: string;
                matriculatedSubjectId?: string;
                evaluationValueId?: string;
            }>;
        };

        if (!professorId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        if (!subjectId || !category || !evaluationDate) {
            return res.status(400).json({ message: 'subjectId, category y evaluationDate son requeridos' });
        }

        if (category === EvaluationCategory.FINAL_EVALUATION && !examinationTypeId) {
            return res.status(400).json({ message: 'examinationTypeId es requerido para FINAL_EVALUATION' });
        }

        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ message: 'entries debe contener al menos una nota' });
        }

        const parsedEvaluationDate = new Date(evaluationDate);
        if (Number.isNaN(parsedEvaluationDate.getTime())) {
            return res.status(400).json({ message: 'evaluationDate no tiene un formato válido' });
        }

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId })
            .select('_id academicYear careerId')
            .lean();

        if (!subject) {
            return res.status(404).json({ message: 'Asignatura no encontrada para el profesor autenticado' });
        }

        const validStudents = await StudentModel.find({
            careerId: subject.careerId,
            academicYear: subject.academicYear
        })
            .select('_id')
            .lean();

        const validStudentIds = validStudents.map((student) => student._id);
        const matriculatedSubjects = await MatriculatedSubjectModel.find({
            subjectId,
            studentId: { $in: validStudentIds },
            academicYear: subject.academicYear
        })
            .select('_id studentId')
            .lean();

        const studentByMatriculated = new Map<string, string>();
        matriculatedSubjects.forEach((item) => {
            studentByMatriculated.set(String(item._id), String(item.studentId));
        });

        const sanitizedDescription = (description || '').trim();
        const savedRows: unknown[] = [];
        const batchTimestamp = new Date();

        for (const entry of entries) {
            if (!entry?.matriculatedSubjectId || !entry.evaluationValueId) {
                continue;
            }

            const studentId = studentByMatriculated.get(entry.matriculatedSubjectId);
            if (!studentId) {
                continue;
            }

            if (entry.evaluationId) {
                const evaluation = await EvaluationScoreModel.findOne({
                    _id: entry.evaluationId,
                    matriculatedSubjectId: entry.matriculatedSubjectId
                });

                if (!evaluation) {
                    continue;
                }

                evaluation.studentId = studentId as any;
                evaluation.matriculatedSubjectId = entry.matriculatedSubjectId as any;
                evaluation.evaluationValueId = entry.evaluationValueId as any;
                evaluation.category = category;
                evaluation.description = sanitizedDescription;
                evaluation.evaluationDate = parsedEvaluationDate;
                if (category === EvaluationCategory.FINAL_EVALUATION) {
                    evaluation.examinationTypeId = examinationTypeId as any;
                } else {
                    evaluation.examinationTypeId = undefined;
                }
                evaluation.registrationDate = null;
                evaluation.createdAt = batchTimestamp;
                evaluation.updatedAt = batchTimestamp;
                await evaluation.save();
                savedRows.push(evaluation.toObject());
            } else {
                const created = await EvaluationScoreModel.create({
                    studentId,
                    matriculatedSubjectId: entry.matriculatedSubjectId,
                    evaluationValueId: entry.evaluationValueId,
                    category,
                    description: sanitizedDescription,
                    examinationTypeId: category === EvaluationCategory.FINAL_EVALUATION ? examinationTypeId : undefined,
                    evaluationDate: parsedEvaluationDate,
                    registrationDate: null,
                    createdAt: batchTimestamp,
                    updatedAt: batchTimestamp
                });
                savedRows.push(created.toObject());
            }
        }

        if (savedRows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No se guardó ningún registro de asistencia.'
            });
        }

        return res.status(200).json({
            success: true,
            savedCount: savedRows.length,
            data: savedRows
        });
    } catch (error: any) {
        console.error('Error in upsertSubjectEvaluationRegister:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to save evaluation register.'
        });
    }
}

export async function getSubjectAttendanceRegisterData(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const subjectId = req.query.subjectId as string | undefined;
        const attendanceDate = req.query.attendanceDate as string | undefined;

        if (!professorId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        if (!subjectId) {
            return res.status(400).json({ message: 'subjectId es requerido' });
        }

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId })
            .select('_id name academicYear careerId')
            .populate('careerId', 'name')
            .lean();

        if (!subject) {
            return res.status(404).json({ message: 'Asignatura no encontrada para el profesor autenticado' });
        }

        const subjectCareerId = typeof subject.careerId === 'object' && subject.careerId
            ? String((subject.careerId as { _id?: unknown })._id || '')
            : String(subject.careerId || '');

        const validStudents = await StudentModel.find({
            careerId: subjectCareerId,
            academicYear: subject.academicYear
        })
            .select('_id')
            .lean();

        const validStudentIds = validStudents.map((student) => student._id);
        const matriculatedSubjects = await MatriculatedSubjectModel.find({
            subjectId,
            studentId: { $in: validStudentIds },
            academicYear: subject.academicYear
        })
            .populate('studentId', 'firstName lastName')
            .sort({ _id: 1 })
            .lean();

        const studentIds = matriculatedSubjects
            .map((item) => {
                const studentRecord = item.studentId as unknown as Record<string, unknown> | null;
                return studentRecord?._id;
            })
            .filter(Boolean);

        const attendanceFilter: Record<string, unknown> = {
            subjectId: subject._id,
            studentId: { $in: studentIds }
        };

        const dayRange = getDayRange(attendanceDate);
        if (dayRange) {
            attendanceFilter.attendanceDate = { $gte: dayRange.start, $lte: dayRange.end };
        }

        const attendanceRows = await AttendanceModel.find(attendanceFilter)
            .select('_id studentId attendanceDate isPresent justified justificationReason')
            .sort({ updatedAt: -1 })
            .lean();

        const attendanceMap = new Map<string, Record<string, unknown>>();
        attendanceRows.forEach((row) => {
            const key = String(row.studentId);
            if (!attendanceMap.has(key)) {
                attendanceMap.set(key, row as unknown as Record<string, unknown>);
            }
        });

        const data = matriculatedSubjects.map((item) => {
            const studentRecord = item.studentId as unknown as Record<string, unknown> | null;
            const studentIdValue = studentRecord?._id ? String(studentRecord._id) : '';
            const existingAttendance = attendanceMap.get(studentIdValue);

            return {
                studentId: studentIdValue,
                studentName: `${(studentRecord?.firstName as string) || ''} ${(studentRecord?.lastName as string) || ''}`.trim() || 'Sin nombre',
                attendance: existingAttendance
                    ? {
                        _id: String(existingAttendance._id || ''),
                        attendanceDate: existingAttendance.attendanceDate,
                        isPresent: Boolean(existingAttendance.isPresent),
                        justified: Boolean(existingAttendance.justified),
                        justificationReason: String(existingAttendance.justificationReason || '')
                    }
                    : null
            };
        });

        return res.status(200).json({
            subject: {
                _id: String(subject._id),
                name: subject.name,
                academicYear: subject.academicYear,
                careerName: typeof subject.careerId === 'object' && subject.careerId
                    ? (subject.careerId as { name?: string }).name || 'Sin carrera'
                    : 'Sin carrera'
            },
            data,
            totalCount: data.length
        });
    } catch (error: any) {
        console.error('Error in getSubjectAttendanceRegisterData:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get attendance register data.'
        });
    }
}

export async function upsertSubjectAttendanceRegister(req: Request, res: Response) {
    try {
        const professorId = req.user?.id;
        const {
            subjectId,
            attendanceDate,
            entries
        } = req.body as {
            subjectId?: string;
            attendanceDate?: string;
            entries?: Array<{
                attendanceId?: string;
                studentId?: string;
                isPresent?: boolean;
                justified?: boolean;
                justificationReason?: string;
            }>;
        };

        if (!professorId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        if (!subjectId || !attendanceDate) {
            return res.status(400).json({ message: 'subjectId y attendanceDate son requeridos' });
        }

        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ message: 'entries debe contener al menos un registro' });
        }

        const parsedAttendanceDate = new Date(attendanceDate);
        if (Number.isNaN(parsedAttendanceDate.getTime())) {
            return res.status(400).json({ message: 'attendanceDate no tiene un formato válido' });
        }

        const dateRange = getDayRange(attendanceDate);
        if (!dateRange) {
            return res.status(400).json({ message: 'attendanceDate no tiene un formato válido' });
        }

        const subject = await SubjectModel.findOne({ _id: subjectId, professorId })
            .select('_id academicYear careerId')
            .lean();

        if (!subject) {
            return res.status(404).json({ message: 'Asignatura no encontrada para el profesor autenticado' });
        }

        const validStudents = await StudentModel.find({
            careerId: subject.careerId,
            academicYear: subject.academicYear
        })
            .select('_id')
            .lean();

        const validStudentIds = validStudents.map((student) => String(student._id));
        const validStudentIdSet = new Set(validStudentIds);
        const isCreateMode = entries.every((entry) => !entry?.attendanceId);
        const requestedStudentIds = entries
            .map((entry) => String(entry?.studentId || ''))
            .filter((id) => id && validStudentIdSet.has(id));

        if (isCreateMode && requestedStudentIds.length > 0) {
            const existingCount = await AttendanceModel.countDocuments({
                subjectId,
                studentId: { $in: requestedStudentIds },
                attendanceDate: {
                    $gte: dateRange.start,
                    $lte: dateRange.end
                }
            });

            if (existingCount > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'Ya existe un registro de asistencia para esa fecha. Usa la opción de editar para modificarlo.'
                });
            }
        }

        const savedRows: unknown[] = [];
        const batchTimestamp = new Date();

        for (const entry of entries) {
            if (!entry?.studentId || !validStudentIdSet.has(String(entry.studentId))) {
                continue;
            }

            const isPresent = Boolean(entry.isPresent);
            const justified = !isPresent && Boolean(entry.justified);
            const justificationReason = !isPresent
                ? String(entry.justificationReason || '').trim()
                : '';

            let attendance = null;
            if (entry.attendanceId) {
                attendance = await AttendanceModel.findOne({
                    _id: entry.attendanceId,
                    subjectId,
                    studentId: entry.studentId
                });
            } else {
                attendance = await AttendanceModel.findOne({
                    subjectId,
                    studentId: entry.studentId,
                    attendanceDate: {
                        $gte: dateRange.start,
                        $lte: dateRange.end
                    }
                });
            }

            if (attendance) {
                attendance.attendanceDate = parsedAttendanceDate;
                attendance.isPresent = isPresent;
                attendance.justified = justified;
                attendance.justificationReason = justificationReason;
                attendance.createdAt = batchTimestamp;
                attendance.updatedAt = batchTimestamp;
                await attendance.save();
                savedRows.push(attendance.toObject());
            } else {
                const created = await AttendanceModel.create({
                    subjectId,
                    studentId: entry.studentId,
                    attendanceDate: parsedAttendanceDate,
                    isPresent,
                    justified,
                    justificationReason,
                    createdAt: batchTimestamp,
                    updatedAt: batchTimestamp
                });
                savedRows.push(created.toObject());
            }
        }

        return res.status(200).json({
            success: true,
            savedCount: savedRows.length,
            data: savedRows
        });
    } catch (error: any) {
        console.error('Error in upsertSubjectAttendanceRegister:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to save attendance register.'
        });
    }
}
