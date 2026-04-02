import { Request, Response } from 'express';
import {
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
