import { Request, Response } from 'express';
import { Types } from 'mongoose';
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
    SubjectModel,
} from '../models/sigenu/index.js';
import SecretaryModel from '../models/system/Secretary.js';

async function getAssignedFacultyId(req: Request) {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
        return null;
    }

    const secretary = await SecretaryModel.findOne({ userId }).select('facultyId').lean();
    return secretary?.facultyId ? String(secretary.facultyId) : null;
}

async function getFacultyCareerIds(facultyId: string): Promise<Types.ObjectId[]> {
    const careers = await CareerModel.find({ facultyId }).select('_id').lean();
    return careers.map((career) => career._id);
}

async function getFacultySubjectIds(careerIds: Types.ObjectId[]): Promise<Types.ObjectId[]> {
    const subjects = await SubjectModel.find({ careerId: { $in: careerIds } }).select('_id').lean();
    return subjects.map((subject) => subject._id);
}

async function getFacultyMatriculatedSubjectIds(subjectIds: Types.ObjectId[]): Promise<Types.ObjectId[]> {
    const matriculatedSubjects = await MatriculatedSubjectModel.find({ subjectId: { $in: subjectIds } }).select('_id').lean();
    return matriculatedSubjects.map((matriculatedSubject) => matriculatedSubject._id);
}

async function getFilteredCareerIds(
    facultyId: string,
    options?: {
        courseTypeId?: string;
        careerId?: string;
    }
): Promise<Types.ObjectId[]> {
    const filter: Record<string, unknown> = { facultyId };
    if (options?.courseTypeId) {
        filter.courseTypeId = options.courseTypeId;
    }
    if (options?.careerId) {
        filter._id = options.careerId;
    }

    const careers = await CareerModel.find(filter).select('_id').lean();
    return careers.map((career) => career._id);
}

export async function getSecretaryProfile(req: Request, res: Response) {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: 'No autorizado' });
        }

        const secretary = await SecretaryModel.findOne({ userId })
            .populate('facultyId', 'name')
            .lean();

        if (!secretary) {
            return res.status(404).json({ message: 'Secretario no encontrado' });
        }

        return res.status(200).json(secretary);
    } catch (error: any) {
        console.error('Error in getSecretaryProfile:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function getStudents(req: Request, res: Response) {
    try {
        const facultyId = await getAssignedFacultyId(req);
        if (!facultyId) {
            return res.status(403).json({ message: 'El secretario no tiene una facultad asignada.' });
        }

        const { courseTypeId, careerId, academicYear } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        let filter: any = {};

        if (careerId) {
            const careerFilter: Record<string, unknown> = { _id: careerId, facultyId };
            if (courseTypeId) {
                careerFilter.courseTypeId = courseTypeId;
            }
            const career = await CareerModel.findOne(careerFilter).select('_id').lean();
            if (!career) {
                return res.status(200).json({ data: [], totalCount: 0, page, limit });
            }
            filter.careerId = careerId;
        } else {
            const careerIds = await getFilteredCareerIds(facultyId, {
                courseTypeId: typeof courseTypeId === 'string' ? courseTypeId : undefined
            });
            filter.careerId = { $in: careerIds };
        }

        if (academicYear) filter.academicYear = academicYear;

        const [students, totalCount] = await Promise.all([
            StudentModel.find(filter)
                .populate({
                    path: 'careerId',
                    select: 'name facultyId',
                    populate: {
                        path: 'facultyId',
                        select: 'name'
                    }
                })
                .populate('courseTypeId', 'name')
                .populate('studentStatusId', 'kind')
                .skip(skip)
                .limit(limit)
                .lean(),
            StudentModel.countDocuments(filter)
        ]);

        const studentsWithNames = students.map(student => ({
            ...student,
            facultyName: ((student.careerId as any)?.facultyId as any)?.name || '',
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

export async function getSubjects(req: Request, res: Response) {
    try {
        const facultyId = await getAssignedFacultyId(req);
        if (!facultyId) {
            return res.status(403).json({ message: 'El secretario no tiene una facultad asignada.' });
        }

        const { courseTypeId, careerId, academicYear } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;
        const careerIds = await getFilteredCareerIds(facultyId, {
            courseTypeId: typeof courseTypeId === 'string' ? courseTypeId : undefined,
            careerId: typeof careerId === 'string' ? careerId : undefined
        });
        const subjectFilter: Record<string, unknown> = { careerId: { $in: careerIds } };
        if (academicYear) {
            subjectFilter.academicYear = academicYear;
        }

        const [subjects, totalCount] = await Promise.all([
            SubjectModel.find(subjectFilter)
                .populate({
                    path: 'careerId',
                    select: 'name facultyId courseTypeId',
                    populate: [
                        { path: 'facultyId', select: 'name' },
                        { path: 'courseTypeId', select: 'name' }
                    ]
                })
                .skip(skip)
                .limit(limit)
                .lean(),
            SubjectModel.countDocuments(subjectFilter)
        ]);

        const subjectsWithCareerNames = subjects.map(subject => ({
            ...subject,
            facultyName: ((subject.careerId as any)?.facultyId as any)?.name || '',
            courseTypeName: ((subject.careerId as any)?.courseTypeId as any)?.name || '',
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

export async function getMatriculatedSubjects(req: Request, res: Response) {
    try {
        const facultyId = await getAssignedFacultyId(req);
        if (!facultyId) {
            return res.status(403).json({ message: 'El secretario no tiene una facultad asignada.' });
        }

        const { courseTypeId, careerId, academicYear, studentId } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        const careerIds = await getFilteredCareerIds(facultyId, {
            courseTypeId: typeof courseTypeId === 'string' ? courseTypeId : undefined,
            careerId: typeof careerId === 'string' ? careerId : undefined
        });
        const subjectIds = await getFacultySubjectIds(careerIds);
        const filter: any = {
            subjectId: { $in: subjectIds }
        };

        if (studentId) {
            filter.studentId = studentId;
        } else if (academicYear) {
            filter.academicYear = academicYear;
        }

        const [matriculatedSubjects, totalCount] = await Promise.all([
            MatriculatedSubjectModel.find(filter)
                .populate({
                    path: 'subjectId',
                    select: 'name careerId',
                    populate: {
                        path: 'careerId',
                        select: 'name facultyId courseTypeId',
                        populate: [
                            { path: 'facultyId', select: 'name' },
                            { path: 'courseTypeId', select: 'name' }
                        ]
                    }
                })
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
                    facultyName: ((subject.subjectId as any)?.careerId as any)?.facultyId?.name || '',
                    courseTypeName: ((subject.subjectId as any)?.careerId as any)?.courseTypeId?.name || '',
                    careerName: ((subject.subjectId as any)?.careerId as any)?.name || '',
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

export async function getEvaluations(req: Request, res: Response) {
    try {
        const facultyId = await getAssignedFacultyId(req);
        if (!facultyId) {
            return res.status(403).json({ message: 'El secretario no tiene una facultad asignada.' });
        }

        const { courseTypeId, careerId, academicYear, studentId } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;
        const careerIds = await getFilteredCareerIds(facultyId, {
            courseTypeId: typeof courseTypeId === 'string' ? courseTypeId : undefined,
            careerId: typeof careerId === 'string' ? careerId : undefined
        });
        const subjectIds = await getFacultySubjectIds(careerIds);
        const matriculatedSubjectFilter: Record<string, unknown> = {
            subjectId: { $in: subjectIds }
        };
        if (studentId) {
            matriculatedSubjectFilter.studentId = studentId;
        } else if (academicYear) {
            matriculatedSubjectFilter.academicYear = academicYear;
        }
        const matriculatedSubjects = await MatriculatedSubjectModel.find(matriculatedSubjectFilter).select('_id').lean();
        const matriculatedSubjectIds = matriculatedSubjects.map((matriculatedSubject) => matriculatedSubject._id);

        const [evaluations, totalCount] = await Promise.all([
            EvaluationModel.find({ matriculatedSubjectId: { $in: matriculatedSubjectIds } })
                .populate('studentId', 'firstName lastName')
                .populate({
                    path: 'matriculatedSubjectId',
                    select: 'subjectId academicYear',
                    populate: {
                        path: 'subjectId',
                        select: 'name careerId',
                        populate: {
                            path: 'careerId',
                            select: 'name facultyId courseTypeId',
                            populate: [
                                { path: 'facultyId', select: 'name' },
                                { path: 'courseTypeId', select: 'name' }
                            ]
                        }
                    }
                })
                .populate('evaluationValueId', 'value')
                .populate('examinationTypeId', 'name')
                .skip(skip)
                .limit(limit)
                .lean(),
            EvaluationModel.countDocuments({ matriculatedSubjectId: { $in: matriculatedSubjectIds } })
        ]);

        const evaluationsWithNames = evaluations.map((evaluation) => {
            const matriculatedSubject = evaluation.matriculatedSubjectId as any;
            const subject = matriculatedSubject?.subjectId as any;
            const career = subject?.careerId as any;

            return {
                ...evaluation,
                studentName: `${(evaluation.studentId as any)?.firstName || ''} ${(evaluation.studentId as any)?.lastName || ''}`.trim(),
                facultyName: career?.facultyId?.name || '',
                courseTypeName: career?.courseTypeId?.name || '',
                careerName: career?.name || '',
                academicYear: matriculatedSubject?.academicYear || '',
                matriculatedSubjectName: subject?.name || '',
                evaluationValue: (evaluation.evaluationValueId as any)?.value || '',
                examinationTypeName: (evaluation.examinationTypeId as any)?.name || ''
            };
        });

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

export async function getDashboardStats(req: Request, res: Response) {
    try {
        const facultyId = await getAssignedFacultyId(req);
        if (!facultyId) {
            return res.status(403).json({ message: 'El secretario no tiene una facultad asignada.' });
        }

        const faculty = await FacultyModel.findById(facultyId).select('name').lean();
        const careerIds = await getFacultyCareerIds(facultyId);
        const subjectIds = await getFacultySubjectIds(careerIds);
        const matriculatedSubjectIds = await getFacultyMatriculatedSubjectIds(subjectIds);

        const stats = {
            facultyName: faculty?.name || '',
            careers: await CareerModel.countDocuments({ facultyId }),
            courseTypes: await CourseTypeModel.countDocuments(),
            evaluations: await EvaluationModel.countDocuments({ matriculatedSubjectId: { $in: matriculatedSubjectIds } }),
            evaluationValues: await EvaluationValueModel.countDocuments(),
            examinationTypes: await ExaminationTypeModel.countDocuments(),
            matriculatedSubjects: await MatriculatedSubjectModel.countDocuments({ subjectId: { $in: subjectIds } }),
            students: await StudentModel.countDocuments({ careerId: { $in: careerIds } }),
            studentStatuses: await StudentStatusModel.countDocuments(),
            subjects: await SubjectModel.countDocuments({ careerId: { $in: careerIds } }),
        };

        return res.status(200).json(stats);
    } catch (error) {
        console.error('Error fetching secretary dashboard stats:', error);
        return res.status(500).json({ message: 'Error fetching stats' });
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
        const facultyId = await getAssignedFacultyId(req);
        if (!facultyId) {
            return res.status(403).json({ message: 'El secretario no tiene una facultad asignada.' });
        }

        const { courseTypeId } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        const filter: any = { facultyId };
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
