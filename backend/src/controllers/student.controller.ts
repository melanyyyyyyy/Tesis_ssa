import { Request, Response } from 'express';
import {
    EvaluationModel,
    MatriculatedSubjectModel,
    StudentModel,
    StudentStatusModel,
    SubjectModel
} from '../models/sigenu/index.js';
import {
    AttendanceModel,
    EvaluationCategory,
    EvaluationScoreModel,
    UserModel
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
    if (values.length === 0) return null;
    const total = values.reduce((sum, current) => sum + current, 0);
    return total / values.length;
};

type EvaluationRowForAverage = {
    sigenId?: string;
    matriculatedSubjectId: unknown;
    category: EvaluationCategory;
    evaluationValueId?: { value?: string } | null;
};

const getSubjectStudentKey = (subjectId: string, studentId: string) => `${subjectId}:${studentId}`;

const mergeLegacyFinalEvaluationsForAverage = (
    evaluationRowsByMatriculated: Map<string, EvaluationRowForAverage[]>,
    legacyEvaluationRows: Array<{
        sigenId?: string;
        matriculatedSubjectId: unknown;
        evaluationValueId?: { value?: string } | null;
    }>
) => {
    legacyEvaluationRows.forEach((evaluation) => {
        const key = String(evaluation.matriculatedSubjectId);
        const current = evaluationRowsByMatriculated.get(key) || [];
        const legacySigenId = String(evaluation.sigenId || '').trim();
        const syncedFinalSigenIds = new Set(
            current
                .filter((row) => row.category === EvaluationCategory.FINAL_EVALUATION)
                .map((row) => String(row.sigenId || '').trim())
                .filter(Boolean)
        );

        if (legacySigenId && syncedFinalSigenIds.has(legacySigenId)) {
            return;
        }

        current.push({
            sigenId: legacySigenId || undefined,
            matriculatedSubjectId: evaluation.matriculatedSubjectId,
            category: EvaluationCategory.FINAL_EVALUATION,
            evaluationValueId: evaluation.evaluationValueId
        });
        evaluationRowsByMatriculated.set(key, current);
    });
};

const calculateSubjectEvaluationAverageForStudent = (
    subjectId: string,
    studentId: string,
    matriculatedIdsBySubjectStudent: Map<string, string[]>,
    evaluationRowsByMatriculated: Map<string, EvaluationRowForAverage[]>
) => {
    const key = getSubjectStudentKey(subjectId, studentId);
    const matriculatedIds = matriculatedIdsBySubjectStudent.get(key) || [];
    if (matriculatedIds.length === 0) return null;

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

    const systematicAverage = systematic.length > 0 ? average(systematic) : null;
    const partialAverage = partial.length > 0 ? average(partial) : null;
    const finalScore = final.length > 0 ? Math.max(...final) : null;

    let totalWeightUsed = 0;
    let weightedSum = 0;

    if (systematicAverage !== null) {
        weightedSum += systematicAverage * weights.systematic;
        totalWeightUsed += weights.systematic;
    }

    if (partialAverage !== null) {
        weightedSum += partialAverage * weights.partial;
        totalWeightUsed += weights.partial;
    }

    if (finalScore !== null) {
        weightedSum += finalScore * weights.final;
        totalWeightUsed += weights.final;
    }

    if (totalWeightUsed === 0) return null;

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

const resolveAuthenticatedStudent = async (userId?: string) => {
    if (!userId) {
        return null;
    }

    const user = await UserModel.findById(userId)
        .select('_id studentId identification')
        .lean();

    if (!user) {
        return null;
    }

    const student = user.studentId
        ? await StudentModel.findById(user.studentId)
            .select('_id careerId courseTypeId academicYear studentStatusId isActive')
            .populate('careerId', 'name')
            .populate('courseTypeId', 'name')
            .populate('studentStatusId', 'kind')
            .lean()
        : await StudentModel.findOne({
            identification: user.identification,
            isActive: true
        })
            .select('_id careerId courseTypeId academicYear studentStatusId isActive')
            .populate('careerId', 'name')
            .populate('courseTypeId', 'name')
            .populate('studentStatusId', 'kind')
            .lean();

    if (!student?._id) {
        return null;
    }

    return {
        user,
        student,
        studentId: String(student._id)
    };
};

export async function getStudentRecordsSummary(req: Request, res: Response) {
    try {
        const userId = req.user?.id;
        const requestedAcademicYear = req.query.academicYear as string | undefined;

        if (!userId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        const resolvedAuth = await resolveAuthenticatedStudent(userId);
        if (!resolvedAuth) {
            return res.status(404).json({ message: 'No se encontró el estudiante asociado al usuario autenticado' });
        }

        const { student, studentId } = resolvedAuth;
        const enrollmentFilter: Record<string, unknown> = { studentId };

        if (requestedAcademicYear) {
            const parsedAcademicYear = Number.parseInt(requestedAcademicYear, 10);
            if (!Number.isFinite(parsedAcademicYear)) {
                return res.status(400).json({ message: 'academicYear debe ser un número válido' });
            }
            enrollmentFilter.academicYear = parsedAcademicYear;
        }

        const matriculatedSubjects = await MatriculatedSubjectModel.find(enrollmentFilter)
            .populate('subjectId', 'name academicYear')
            .sort({ academicYear: 1, subjectId: 1, _id: 1 })
            .lean();

        if (matriculatedSubjects.length === 0) {
            return res.status(200).json({
                data: [],
                totalCount: 0,
                academicYears: []
            });
        }

        const matriculatedIds = matriculatedSubjects.map((item) => item._id);
        const subjectIdsForQuery = Array.from(new Set(
            matriculatedSubjects
                .map((item) => {
                    const subjectRecord = item.subjectId as unknown as Record<string, unknown> | null;
                    return subjectRecord && typeof subjectRecord === 'object' && '_id' in subjectRecord
                        ? subjectRecord._id
                        : item.subjectId;
                })
                .filter(Boolean)
        ));

        const [attendanceRows, evaluationRows, legacyEvaluationRows] = await Promise.all([
            AttendanceModel.aggregate([
                {
                    $match: {
                        studentId: student._id,
                        subjectId: { $in: subjectIdsForQuery }
                    }
                },
                {
                    $group: {
                        _id: '$subjectId',
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
                studentId: student._id,
                matriculatedSubjectId: { $in: matriculatedIds }
            })
                .populate('evaluationValueId', 'value')
                .select('sigenId matriculatedSubjectId category evaluationValueId')
                .lean(),
            EvaluationModel.find({
                studentId: student._id,
                matriculatedSubjectId: { $in: matriculatedIds }
            })
                .populate('evaluationValueId', 'value')
                .select('sigenId matriculatedSubjectId evaluationValueId')
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
            const subjectRecord = item.subjectId as unknown as Record<string, unknown> | null;
            const subjectIdValue = subjectRecord && typeof subjectRecord === 'object' && '_id' in subjectRecord
                ? subjectRecord._id
                : item.subjectId;

            const subjectKey = subjectIdValue ? String(subjectIdValue) : '';
            if (!subjectKey) return;

            const key = getSubjectStudentKey(subjectKey, studentId);
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

        const syncedSigenIds = new Set(
            evaluationRows
                .map((evaluation: any) => String(evaluation.sigenId || '').trim())
                .filter(Boolean)
        );

        legacyEvaluationRows.forEach((evaluation: any) => {
            if (evaluation.sigenId && syncedSigenIds.has(String(evaluation.sigenId))) {
                return;
            }

            const key = String(evaluation.matriculatedSubjectId);
            const current = evaluationRowsByMatriculated.get(key) || [];
            current.push({
                matriculatedSubjectId: evaluation.matriculatedSubjectId,
                category: EvaluationCategory.FINAL_EVALUATION,
                evaluationValueId: evaluation.evaluationValueId as { value?: string } | null
            });
            evaluationRowsByMatriculated.set(key, current);
        });

        const data = matriculatedSubjects.map((item) => {
            const subjectRecord = item.subjectId as unknown as Record<string, unknown> | null;
            const subjectIdValue = subjectRecord && typeof subjectRecord === 'object' && '_id' in subjectRecord
                ? subjectRecord._id
                : item.subjectId;
            const subjectKey = subjectIdValue ? String(subjectIdValue) : '';
            const attendance = attendanceMap.get(subjectKey);
            const attendanceAverage = attendance && attendance.total > 0
                ? (attendance.present / attendance.total) * 100
                : null;
            const evaluationAverage = subjectKey
                ? calculateSubjectEvaluationAverageForStudent(
                    subjectKey,
                    studentId,
                    matriculatedIdsBySubjectStudent,
                    evaluationRowsByMatriculated
                )
                : null;

            return {
                _id: String(item._id),
                subjectId: subjectKey,
                subjectName: (subjectRecord?.name as string) || 'Sin asignatura',
                academicYear: item.academicYear,
                attendanceAverage: attendanceAverage !== null ? Number(attendanceAverage.toFixed(2)) : null,
                evaluationAverage
            };
        });

        const academicYears = Array.from(new Set(data.map((item) => item.academicYear))).sort((a, b) => a - b);

        return res.status(200).json({
            data,
            totalCount: data.length,
            academicYears
        });
    } catch (error: any) {
        console.error('Error in getStudentRecordsSummary:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get student records summary.'
        });
    }
}

export async function getStudentSubjectEvaluationRecords(req: Request, res: Response) {
    try {
        const userId = req.user?.id;
        const subjectId = req.query.subjectId as string | undefined;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        if (!userId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        if (!subjectId) {
            return res.status(400).json({ message: 'subjectId es requerido' });
        }

        const resolvedAuth = await resolveAuthenticatedStudent(userId);
        if (!resolvedAuth) {
            return res.status(404).json({ message: 'No se encontró el estudiante asociado al usuario autenticado' });
        }

        const { studentId } = resolvedAuth;
        const [subject, matriculatedSubjects] = await Promise.all([
            SubjectModel.findById(subjectId)
                .select('_id name academicYear')
                .lean(),
            MatriculatedSubjectModel.find({ subjectId, studentId })
                .select('_id')
                .lean()
        ]);

        if (!subject) {
            return res.status(404).json({ message: 'Asignatura no encontrada' });
        }

        const matriculatedIds = matriculatedSubjects.map((item) => item._id);
        if (matriculatedIds.length === 0) {
            return res.status(200).json({
                data: [],
                totalCount: 0,
                page,
                limit,
                summary: {
                    evaluationAverage: null
                }
            });
        }

        const filter = {
            studentId,
            matriculatedSubjectId: { $in: matriculatedIds }
        };

        const [evaluationScoreRows, legacyEvaluationRows] = await Promise.all([
            EvaluationScoreModel.find(filter)
                .populate('evaluationValueId', 'value')
                .populate('examinationTypeId', 'name')
                .sort({ evaluationDate: -1, updatedAt: -1 })
                .lean(),
            EvaluationModel.find({
                studentId,
                matriculatedSubjectId: { $in: matriculatedIds }
            })
                .populate('evaluationValueId', 'value')
                .populate('examinationTypeId', 'name')
                .sort({ evaluationDate: -1, registrationDate: -1 })
                .lean()
        ]);

        const syncedSigenIds = new Set(
            evaluationScoreRows
                .map((evaluation: any) => String(evaluation.sigenId || '').trim())
                .filter(Boolean)
        );

        const rows = [
            ...evaluationScoreRows.map((row: any) => ({
                ...row,
                recordKey: `evaluationScore:${String(row._id)}`,
                source: 'evaluationScore',
                isReadOnly: false
            })),
            ...legacyEvaluationRows
                .filter((row: any) => !row.sigenId || !syncedSigenIds.has(String(row.sigenId)))
                .map((row: any) => ({
                    ...row,
                    category: EvaluationCategory.FINAL_EVALUATION,
                    description: '',
                    recordKey: `evaluation:${String(row._id)}`,
                    source: 'evaluation',
                    isReadOnly: true
                }))
        ].sort((a: any, b: any) => {
            const dateDiff = new Date(b.evaluationDate).getTime() - new Date(a.evaluationDate).getTime();
            if (dateDiff !== 0) return dateDiff;
            const updatedA = new Date(a.updatedAt || a.registrationDate || a.createdAt || 0).getTime();
            const updatedB = new Date(b.updatedAt || b.registrationDate || b.createdAt || 0).getTime();
            return updatedB - updatedA;
        });

        const evaluationRowsByMatriculated = new Map<string, EvaluationRowForAverage[]>();
        evaluationScoreRows.forEach((evaluation: any) => {
            const key = String(evaluation.matriculatedSubjectId);
            const current = evaluationRowsByMatriculated.get(key) || [];
            current.push(evaluation as unknown as EvaluationRowForAverage);
            evaluationRowsByMatriculated.set(key, current);
        });

        legacyEvaluationRows.forEach((evaluation: any) => {
            if (evaluation.sigenId && syncedSigenIds.has(String(evaluation.sigenId))) {
                return;
            }

            const key = String(evaluation.matriculatedSubjectId);
            const current = evaluationRowsByMatriculated.get(key) || [];
            current.push({
                matriculatedSubjectId: evaluation.matriculatedSubjectId,
                category: EvaluationCategory.FINAL_EVALUATION,
                evaluationValueId: evaluation.evaluationValueId as { value?: string } | null
            });
            evaluationRowsByMatriculated.set(key, current);
        });

        const matriculatedIdsBySubjectStudent = new Map<string, string[]>();
        matriculatedIdsBySubjectStudent.set(
            getSubjectStudentKey(subjectId, studentId),
            matriculatedIds.map((item) => String(item))
        );

        const evaluationAverage = calculateSubjectEvaluationAverageForStudent(
            subjectId,
            studentId,
            matriculatedIdsBySubjectStudent,
            evaluationRowsByMatriculated
        );

        return res.status(200).json({
            data: rows.slice(skip, skip + limit),
            totalCount: rows.length,
            page,
            limit,
            subject: {
                _id: String(subject._id),
                name: subject.name,
                academicYear: subject.academicYear
            },
            summary: {
                evaluationAverage
            }
        });
    } catch (error: any) {
        console.error('Error in getStudentSubjectEvaluationRecords:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get student subject evaluation records.'
        });
    }
}

export async function getStudentSubjectAttendanceRecords(req: Request, res: Response) {
    try {
        const userId = req.user?.id;
        const subjectId = req.query.subjectId as string | undefined;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        if (!userId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        if (!subjectId) {
            return res.status(400).json({ message: 'subjectId es requerido' });
        }

        const resolvedAuth = await resolveAuthenticatedStudent(userId);
        if (!resolvedAuth) {
            return res.status(404).json({ message: 'No se encontró el estudiante asociado al usuario autenticado' });
        }

        const { studentId } = resolvedAuth;
        const matriculatedSubject = await MatriculatedSubjectModel.findOne({ subjectId, studentId })
            .select('_id')
            .lean();

        if (!matriculatedSubject) {
            return res.status(200).json({
                data: [],
                totalCount: 0,
                page,
                limit
            });
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
        console.error('Error in getStudentSubjectAttendanceRecords:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get student subject attendance records.'
        });
    }
}

export async function getStudentAcademicRanking(req: Request, res: Response) {
    try {
        const userId = req.user?.id;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;

        if (!userId) {
            return res.status(401).json({ message: 'Usuario no autenticado' });
        }

        const resolvedAuth = await resolveAuthenticatedStudent(userId);
        if (!resolvedAuth) {
            return res.status(404).json({ message: 'No se encontró el estudiante asociado al usuario autenticado' });
        }

        const { student } = resolvedAuth;
        const studentCareerId = typeof student.careerId === 'object' && student.careerId
            ? String((student.careerId as { _id?: unknown })._id || '')
            : String(student.careerId || '');
        const studentCourseTypeId = typeof student.courseTypeId === 'object' && student.courseTypeId
            ? String((student.courseTypeId as { _id?: unknown })._id || '')
            : String(student.courseTypeId || '');
        const studentAcademicYear = typeof student.academicYear === 'number' ? student.academicYear : Number(student.academicYear);

        if (!studentCareerId || !studentCourseTypeId || !Number.isFinite(studentAcademicYear)) {
            return res.status(400).json({ message: 'No se pudo determinar el grupo académico del estudiante autenticado' });
        }

        const activeStatuses = await StudentStatusModel.find({ kind: 'Activo' })
            .select('_id')
            .lean();
        const activeStatusIds = activeStatuses.map((status) => status._id);

        if (activeStatusIds.length === 0) {
            return res.status(200).json({
                cohort: {
                    careerName: typeof student.careerId === 'object' && student.careerId
                        ? (student.careerId as { name?: string }).name || 'Sin carrera'
                        : 'Sin carrera',
                    courseTypeName: typeof student.courseTypeId === 'object' && student.courseTypeId
                        ? (student.courseTypeId as { name?: string }).name || 'Sin tipo de curso'
                        : 'Sin tipo de curso',
                    academicYear: studentAcademicYear
                },
                data: [],
                totalCount: 0,
                page,
                limit
            });
        }

        const cohortStudents = await StudentModel.find({
            careerId: studentCareerId,
            courseTypeId: studentCourseTypeId,
            academicYear: studentAcademicYear,
            isActive: true,
            studentStatusId: { $in: activeStatusIds }
        })
            .select('_id firstName lastName')
            .sort({ lastName: 1, firstName: 1, _id: 1 })
            .lean();

        const totalCount = cohortStudents.length;
        if (totalCount === 0) {
            return res.status(200).json({
                cohort: {
                    careerName: typeof student.careerId === 'object' && student.careerId
                        ? (student.careerId as { name?: string }).name || 'Sin carrera'
                        : 'Sin carrera',
                    courseTypeName: typeof student.courseTypeId === 'object' && student.courseTypeId
                        ? (student.courseTypeId as { name?: string }).name || 'Sin tipo de curso'
                        : 'Sin tipo de curso',
                    academicYear: studentAcademicYear
                },
                data: [],
                totalCount: 0,
                page,
                limit
            });
        }

        const cohortStudentIds = cohortStudents.map((cohortStudent) => cohortStudent._id);
        const allMatriculatedForStudents = await MatriculatedSubjectModel.find({
            studentId: { $in: cohortStudentIds }
        })
            .select('_id subjectId studentId')
            .lean();

        const allMatriculatedIds = allMatriculatedForStudents.map((item) => item._id);
        const [evaluationScoreRows, legacyEvaluationRows] = allMatriculatedIds.length > 0
            ? await Promise.all([
                EvaluationScoreModel.find({
                    matriculatedSubjectId: { $in: allMatriculatedIds }
                })
                    .populate('evaluationValueId', 'value')
                    .select('sigenId matriculatedSubjectId category evaluationValueId')
                    .lean(),
                EvaluationModel.find({
                    matriculatedSubjectId: { $in: allMatriculatedIds }
                })
                    .populate('evaluationValueId', 'value')
                    .select('sigenId matriculatedSubjectId evaluationValueId')
                    .lean()
            ])
            : [[], []];

        const matriculatedIdsBySubjectStudent = new Map<string, string[]>();
        const subjectIdsByStudent = new Map<string, Set<string>>();

        allMatriculatedForStudents.forEach((item) => {
            const studentKey = String(item.studentId);
            const subjectId = String(item.subjectId);
            const key = getSubjectStudentKey(subjectId, studentKey);
            const current = matriculatedIdsBySubjectStudent.get(key) || [];
            current.push(String(item._id));
            matriculatedIdsBySubjectStudent.set(key, current);

            const studentSubjects = subjectIdsByStudent.get(studentKey) || new Set<string>();
            studentSubjects.add(subjectId);
            subjectIdsByStudent.set(studentKey, studentSubjects);
        });

        const evaluationRowsByMatriculated = new Map<string, EvaluationRowForAverage[]>();
        evaluationScoreRows.forEach((evaluation) => {
            const key = String(evaluation.matriculatedSubjectId);
            const current = evaluationRowsByMatriculated.get(key) || [];
            current.push(evaluation as unknown as EvaluationRowForAverage);
            evaluationRowsByMatriculated.set(key, current);
        });

        mergeLegacyFinalEvaluationsForAverage(
            evaluationRowsByMatriculated,
            legacyEvaluationRows as Array<{
                sigenId?: string;
                matriculatedSubjectId: unknown;
                evaluationValueId?: { value?: string } | null;
            }>
        );

        const rankingRows = cohortStudents.map((cohortStudent) => {
            const studentId = String(cohortStudent._id);
            const studentName = `${cohortStudent.firstName || ''} ${cohortStudent.lastName || ''}`.trim() || 'Sin nombre';
            const studentSubjectIds = Array.from(subjectIdsByStudent.get(studentId) || []);
            const subjectAverages = studentSubjectIds
                .filter((subjectId) => hasEvaluationsForSubjectStudent(
                    subjectId,
                    studentId,
                    matriculatedIdsBySubjectStudent,
                    evaluationRowsByMatriculated
                ))
                .map((subjectId) => calculateSubjectEvaluationAverageForStudent(
                    subjectId,
                    studentId,
                    matriculatedIdsBySubjectStudent,
                    evaluationRowsByMatriculated
                ))
                .filter((averageValue): averageValue is number => averageValue !== null);

            const generalAverageValue = average(subjectAverages);

            return {
                _id: studentId,
                studentId,
                studentName,
                generalAverage: generalAverageValue !== null ? Number(generalAverageValue.toFixed(2)) : null
            };
        });

        rankingRows.sort((a, b) => {
            const generalAverageA = a.generalAverage ?? Number.NEGATIVE_INFINITY;
            const generalAverageB = b.generalAverage ?? Number.NEGATIVE_INFINITY;

            if (generalAverageB !== generalAverageA) return generalAverageB - generalAverageA;
            return a.studentName.localeCompare(b.studentName, 'es');
        });

        const start = page * limit;
        const end = start + limit;

        return res.status(200).json({
            cohort: {
                careerName: typeof student.careerId === 'object' && student.careerId
                    ? (student.careerId as { name?: string }).name || 'Sin carrera'
                    : 'Sin carrera',
                courseTypeName: typeof student.courseTypeId === 'object' && student.courseTypeId
                    ? (student.courseTypeId as { name?: string }).name || 'Sin tipo de curso'
                    : 'Sin tipo de curso',
                academicYear: studentAcademicYear
            },
            data: rankingRows.slice(start, end),
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getStudentAcademicRanking:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get student academic ranking.'
        });
    }
}
