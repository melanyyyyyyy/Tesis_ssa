import { Request, Response } from 'express';
import {
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

const toNumericScore = (value: unknown) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;

    const match = value.match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return 0;
    const parsed = Number.parseFloat(match[0].replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
};

const average = (values: number[]) => {
    if (!values.length) return 0;
    const total = values.reduce((sum, current) => sum + current, 0);
    return total / values.length;
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

        const evaluationMap = new Map<string, {
            systematic: number[];
            partial: number[];
            final: number[];
        }>();

        evaluationRows.forEach((evaluation) => {
            const key = String(evaluation.matriculatedSubjectId);
            const current = evaluationMap.get(key) || {
                systematic: [],
                partial: [],
                final: []
            };

            const evaluationValue = evaluation.evaluationValueId as { value?: string } | null;
            const numericValue = toNumericScore(evaluationValue?.value);

            if (evaluation.category === EvaluationCategory.SYSTEMATIC_EVALUATION) {
                current.systematic.push(numericValue);
            } else if (evaluation.category === EvaluationCategory.PARTIAL_EVALUATION) {
                current.partial.push(numericValue);
            } else if (evaluation.category === EvaluationCategory.FINAL_EVALUATION) {
                current.final.push(numericValue);
            }

            evaluationMap.set(key, current);
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

            const evaluations = evaluationMap.get(String(item._id)) || {
                systematic: [],
                partial: [],
                final: []
            };

            const systematicAverage = average(evaluations.systematic);
            const partialAverage = average(evaluations.partial);
            const finalScore = evaluations.final.length > 0 ? Math.max(...evaluations.final) : 0;
            const evaluationAverage = (systematicAverage * 0.2) + (partialAverage * 0.3) + (finalScore * 0.5);

            return {
                _id: String(item._id),
                studentId: studentIdValue ? String(studentIdValue) : null,
                studentName: `${(studentRecord?.firstName as string) || ''} ${(studentRecord?.lastName as string) || ''}`.trim() || 'Sin nombre',
                attendanceAverage: Number(attendanceAverage.toFixed(2)),
                evaluationAverage: Number(evaluationAverage.toFixed(2)),
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
                    registrationDate: null
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
        const savedRows: unknown[] = [];

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
                await attendance.save();
                savedRows.push(attendance.toObject());
            } else {
                const created = await AttendanceModel.create({
                    subjectId,
                    studentId: entry.studentId,
                    attendanceDate: parsedAttendanceDate,
                    isPresent,
                    justified,
                    justificationReason
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
