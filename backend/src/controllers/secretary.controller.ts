import { Request, Response } from 'express';
import {
    CareerModel,
    CourseTypeModel,
    FacultyModel,
} from '../models/sigenu/index.js';
import SecretaryModel from '../models/system/Secretary.js';

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
