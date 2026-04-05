import { Request, Response } from 'express';
import {
    CareerModel,
    CourseTypeModel,
    EvaluationModel,
    EvaluationValueModel,
    ExaminationTypeModel,
    FacultyModel,
    MatriculatedSubjectModel,
    StudentModel,
    StudentStatusModel,
    SubjectModel
} from '../models/sigenu/index.js';
import { EvaluationScoreModel } from '../models/system/index.js';
import { SyncService } from '../services/sync.service.js';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const stats = {
            careers: await CareerModel.countDocuments(),
            courseTypes: await CourseTypeModel.countDocuments(),
            evaluations: await EvaluationModel.countDocuments(),
            evaluationValues: await EvaluationValueModel.countDocuments(),
            examinationTypes: await ExaminationTypeModel.countDocuments(),
            faculties: await FacultyModel.countDocuments(),
            matriculatedSubjects: await MatriculatedSubjectModel.countDocuments(),
            students: await StudentModel.countDocuments(),
            studentStatuses: await StudentStatusModel.countDocuments(),
            subjects: await SubjectModel.countDocuments(),
        };

        res.status(200).json(stats);
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Error fetching stats' });
    }
};

export async function getPendingGradesCount(req: Request, res: Response) {
    try {
        const count = await SyncService.getPendingGradesCount();
        const lastExport = await SyncService.getLastExportStats();
        return res.status(200).json({
            success: true,
            count,
            lastExport
        });
    } catch (error: any) {
        console.error('Error in getPendingGradesCount:', error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to get pending grades count."
        });
    }
}

export async function getPendingGradesList(req: Request, res: Response) {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;
        
        const grades = await SyncService.getPendingGrades(skip, limit);
        const totalCount = await SyncService.getPendingGradesCount();
        
        return res.status(200).json({
            data: grades,
            totalCount: totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getPendingGradesList:', error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to get pending grades list."
        });
    }
}

export async function getLastExportGradesList(req: Request, res: Response) {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;
        
        const grades = await SyncService.getLastExportGrades(skip, limit);
        const totalCount = await SyncService.getLastExportGradesCount();
        
        return res.status(200).json({
            data: grades,
            totalCount: totalCount.count,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getLastExportGradesList:', error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to get last export grades list."
        });
    }
}

export async function deleteEvaluation(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const deleted = await EvaluationScoreModel.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Evaluación no encontrada' });
        }

        return res.status(200).json({ success: true, message: 'Evaluación eliminada correctamente' });
    } catch (error: any) {
        console.error('Error in deleteEvaluation:', error);
        return res.status(500).json({
            success: false,
            error: error.message || "Failed to delete evaluation."
        });
    }
}

export async function createEvaluation(req: Request, res: Response) {
    try {
        const { matriculatedSubjectId, evaluationValueId, examinationTypeId, description, category, evaluationDate } = req.body;

        const matriculatedSubject = await MatriculatedSubjectModel.findById(matriculatedSubjectId);
        if (!matriculatedSubject) {
            return res.status(404).json({ success: false, message: 'Asignatura matriculada no encontrada' });
        }

        const newEvaluation = new EvaluationScoreModel({
            studentId: matriculatedSubject.studentId,
            matriculatedSubjectId,
            evaluationValueId,
            examinationTypeId,
            description,
            category,
            evaluationDate: new Date(evaluationDate),
            registrationDate: null
        });

        await newEvaluation.save();

        const populatedEvaluation = await EvaluationScoreModel.findById(newEvaluation._id)
            .populate({
                path: 'studentId',
                select: 'firstName lastName careerId',
                populate: {
                    path: 'careerId',
                    model: 'Career',
                    select: 'name'
                }
            })
            .populate({
                path: 'matriculatedSubjectId',
                populate: { path: 'subjectId', select: 'name' }
            })
            .populate('evaluationValueId', 'value')
            .populate('examinationTypeId', 'name')
            .lean();

        return res.status(201).json(populatedEvaluation);
    } catch (error: any) {
        console.error('Error in createEvaluation:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function updateEvaluation(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { matriculatedSubjectId, evaluationValueId, examinationTypeId, description, category, evaluationDate } = req.body;

        const evaluation = await EvaluationScoreModel.findById(id);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: 'Evaluación no encontrada' });
        }

        if (matriculatedSubjectId && matriculatedSubjectId !== evaluation.matriculatedSubjectId.toString()) {
            const matriculatedSubject = await MatriculatedSubjectModel.findById(matriculatedSubjectId);
            if (!matriculatedSubject) {
                return res.status(404).json({ success: false, message: 'Asignatura matriculada no encontrada' });
            }
            evaluation.studentId = matriculatedSubject.studentId;
            evaluation.matriculatedSubjectId = matriculatedSubjectId;
        }

        if (evaluationValueId) evaluation.evaluationValueId = evaluationValueId;
        if (examinationTypeId) evaluation.examinationTypeId = examinationTypeId;
        if (description) evaluation.description = description;
        if (category) evaluation.category = category;
        if (evaluationDate) evaluation.evaluationDate = evaluationDate;

        await evaluation.save();

        const populatedEvaluation = await EvaluationScoreModel.findById(evaluation._id)
            .populate({
                path: 'studentId',
                select: 'firstName lastName careerId',
                populate: {
                    path: 'careerId',
                    model: 'Career',
                    select: 'name'
                }
            })
            .populate({
                path: 'matriculatedSubjectId',
                populate: { path: 'subjectId', select: 'name' }
            })
            .populate('evaluationValueId', 'value')
            .populate('examinationTypeId', 'name')
            .lean();

        return res.status(200).json(populatedEvaluation);
    } catch (error: any) {
        console.error('Error in updateEvaluation:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function getMatriculatedSubjects(req: Request, res: Response) {
    try {
        const { facultyId, studentId } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        let filter: any = {};

        if (studentId) {
            filter.studentId = studentId;
        } else if (facultyId) {
            const careers = await CareerModel.find({ facultyId }).select('_id');
            const careerIds = careers.map(c => c._id);

            const subjects = await SubjectModel.find({ careerId: { $in: careerIds } }).select('_id');
            const subjectIds = subjects.map(s => s._id);

            filter.subjectId = { $in: subjectIds };
        } else {
            console.log('No filter provided, returning all subjects (potentially large payload)');
        }

        const [matriculatedSubjects, totalCount] = await Promise.all([
            MatriculatedSubjectModel.find(filter)
                .populate('subjectId', 'name')
                .populate('studentId', 'firstName lastName')
                .skip(skip)
                .limit(limit)
                .lean(),
            MatriculatedSubjectModel.countDocuments(filter)
        ]);

        const subjectsWithEvaluation = await Promise.all(
            matriculatedSubjects.map(async (subject) => {
                const evaluation = await EvaluationModel.findOne({
                    matriculatedSubjectId: subject._id,
                    studentId: subject.studentId
                })
                    .populate('evaluationValueId', 'value')
                    .populate('examinationTypeId', 'name')
                    .lean();

                return {
                    ...subject,
                    subjectName: (subject.subjectId as any)?.name || '',
                    studentName: `${(subject.studentId as any)?.firstName || ''} ${(subject.studentId as any)?.lastName || ''}`.trim(),
                    evaluation: evaluation ?
                        `${(evaluation.evaluationValueId as any)?.value || ''} - ${(evaluation.examinationTypeId as any)?.name || ''}` :
                        ''
                };
            })
        );

        return res.status(200).json({
            data: subjectsWithEvaluation,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getMatriculatedSubjects:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function getFaculties(req: Request, res: Response) {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        const [faculties, totalCount] = await Promise.all([
            FacultyModel.find().skip(skip).limit(limit).lean(),
            FacultyModel.countDocuments()
        ]);

        return res.status(200).json({
            data: faculties,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getFaculties:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function getCareers(req: Request, res: Response) {
    try {
        const { facultyId, courseTypeId } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        const filter: any = {};
        if (facultyId) filter.facultyId = facultyId;
        if (courseTypeId) filter.courseTypeId = courseTypeId;

        const [careers, totalCount] = await Promise.all([
            CareerModel.find(filter)
                .populate('facultyId', 'name')
                .populate('courseTypeId', 'name')
                .skip(skip)
                .limit(limit)
                .lean(),
            CareerModel.countDocuments(filter)
        ]);

        const careersWithNames = careers.map(career => ({
            ...career,
            facultyName: (career.facultyId as any)?.name || '',
            courseTypeName: (career.courseTypeId as any)?.name || ''
        }));

        return res.status(200).json({
            data: careersWithNames,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getCareers:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function getCourseTypes(req: Request, res: Response) {
    try {
        const { facultyId } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        const allowedCourseTypes = ['Curso Diurno', 'Curso por Encuentros'];

        if (facultyId) {
            const careers = await CareerModel.find({ facultyId }).lean();
            const courseTypeIds = [...new Set(careers.map(career => career.courseTypeId.toString()))];

            const [courseTypes, totalCount] = await Promise.all([
                CourseTypeModel.find({
                    _id: { $in: courseTypeIds },
                    name: { $in: allowedCourseTypes }
                }).skip(skip).limit(limit).lean(),
                CourseTypeModel.countDocuments({
                    _id: { $in: courseTypeIds },
                    name: { $in: allowedCourseTypes }
                })
            ]);

            return res.status(200).json({
                data: courseTypes,
                totalCount,
                page,
                limit
            });
        } else {
            const [courseTypes, totalCount] = await Promise.all([
                CourseTypeModel.find({
                    name: { $in: allowedCourseTypes }
                }).skip(skip).limit(limit).lean(),
                CourseTypeModel.countDocuments({
                    name: { $in: allowedCourseTypes }
                })
            ]);

            return res.status(200).json({
                data: courseTypes,
                totalCount,
                page,
                limit
            });
        }
    } catch (error: any) {
        console.error('Error in getCourseTypes:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function getStudents(req: Request, res: Response) {
    try {
        const { facultyId, careerId, academicYear } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        let filter: any = {};

        if (careerId) filter.careerId = careerId;
        if (academicYear) filter.academicYear = academicYear;

        if (facultyId && !careerId) {
            const careers = await CareerModel.find({ facultyId }).select('_id');
            const careerIds = careers.map(c => c._id);
            filter.careerId = { $in: careerIds };
        }

        const [students, totalCount] = await Promise.all([
            StudentModel.find(filter)
                .populate('careerId', 'name')
                .populate('courseTypeId', 'name')
                .populate('studentStatusId', 'kind')
                .skip(skip)
                .limit(limit)
                .lean(),
            StudentModel.countDocuments(filter)
        ]);

        const studentsWithNames = students.map(student => ({
            ...student,
            careerName: (student.careerId as any)?.name || '',
            courseTypeName: (student.courseTypeId as any)?.name || '',
            studentStatusType: (student.studentStatusId as any)?.kind || ''
        }));

        return res.status(200).json({
            data: studentsWithNames,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getStudents:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function getEvaluationValues(req: Request, res: Response) {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        const [values, totalCount] = await Promise.all([
            EvaluationValueModel.find().skip(skip).limit(limit).lean(),
            EvaluationValueModel.countDocuments()
        ]);

        return res.status(200).json({
            data: values,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getEvaluationValues:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function getExaminationTypes(req: Request, res: Response) {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        const [types, totalCount] = await Promise.all([
            ExaminationTypeModel.find().skip(skip).limit(limit).lean(),
            ExaminationTypeModel.countDocuments()
        ]);

        return res.status(200).json({
            data: types,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getExaminationTypes:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function getEvaluations(req: Request, res: Response) {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        const [evaluations, totalCount] = await Promise.all([
            EvaluationModel.find()
                .populate('studentId', 'firstName lastName')
                .populate('matriculatedSubjectId')
                .populate('evaluationValueId', 'value')
                .populate('examinationTypeId', 'name')
                .skip(skip)
                .limit(limit)
                .lean(),
            EvaluationModel.countDocuments()
        ]);

        const evaluationsWithNames = await Promise.all(
            evaluations.map(async (evaluation) => {
                const matriculatedSubject = evaluation.matriculatedSubjectId as any;
                let subjectName = '';
                if (matriculatedSubject?.subjectId) {
                    const subject = await SubjectModel.findById(matriculatedSubject.subjectId).select('name').lean();
                    subjectName = subject?.name || '';
                }

                return {
                    ...evaluation,
                    studentName: `${(evaluation.studentId as any)?.firstName || ''} ${(evaluation.studentId as any)?.lastName || ''}`.trim(),
                    matriculatedSubjectName: subjectName,
                    evaluationValue: (evaluation.evaluationValueId as any)?.value || '',
                    examinationTypeName: (evaluation.examinationTypeId as any)?.name || ''
                };
            })
        );

        return res.status(200).json({
            data: evaluationsWithNames,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getEvaluations:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function getSubjects(req: Request, res: Response) {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        const [subjects, totalCount] = await Promise.all([
            SubjectModel.find()
                .populate('careerId', 'name')
                .skip(skip)
                .limit(limit)
                .lean(),
            SubjectModel.countDocuments()
        ]);

        const subjectsWithCareerNames = subjects.map(subject => ({
            ...subject,
            careerName: (subject.careerId as any)?.name || ''
        }));

        return res.status(200).json({
            data: subjectsWithCareerNames,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getSubjects:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function getStudentStatuses(req: Request, res: Response) {
    try {
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        const [statuses, totalCount] = await Promise.all([
            StudentStatusModel.find().skip(skip).limit(limit).lean(),
            StudentStatusModel.countDocuments()
        ]);

        return res.status(200).json({
            data: statuses,
            totalCount,
            page,
            limit
        });
    } catch (error: any) {
        console.error('Error in getStudentStatuses:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
