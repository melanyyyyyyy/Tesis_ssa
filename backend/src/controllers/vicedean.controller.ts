import { Request, Response } from 'express';
import Career from '../models/sigenu/Career.js';
import CourseType from '../models/sigenu/CourseType.js';
import Subject from '../models/sigenu/Subject.js';
import Role from '../models/system/Role.js';
import User from '../models/system/User.js';
import Vicedean from '../models/system/Vicedean.js';

const getVicedeanRecord = async (userId: string) => {
  return Vicedean.findOne({ userId }).populate('facultyId', 'name').lean();
};

const getFacultyIdFromVicedean = (vicedean: Awaited<ReturnType<typeof getVicedeanRecord>>) => {
  const facultyField = vicedean?.facultyId as { _id?: { toString(): string } } | string | undefined;
  if (!facultyField) return null;
  if (typeof facultyField === 'string') return facultyField;
  return facultyField._id?.toString() || null;
};

export const getVicedeanProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const vicedean = await getVicedeanRecord(userId);

    if (!vicedean) {
      return res.status(404).json({ message: 'Vicedecano no encontrado' });
    }

    return res.status(200).json(vicedean);
  } catch (error) {
    console.error('Error fetching vicedean profile:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getVicedeanCareers = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const vicedean = await getVicedeanRecord(userId);
    if (!vicedean) {
      return res.status(404).json({ message: 'Vicedecano no encontrado' });
    }

    const { courseTypeId } = req.query;
    const page = parseInt(req.query.page as string, 10) || 0;
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const skip = page * limit;
    const facultyId = getFacultyIdFromVicedean(vicedean);
    if (!facultyId) {
      return res.status(404).json({ message: 'No se pudo determinar la facultad del vicedecano' });
    }

    const careerFilter: Record<string, unknown> = { facultyId };
    if (courseTypeId) {
      careerFilter.courseTypeId = courseTypeId;
    }

    const [careers, totalCount] = await Promise.all([
      Career.find(careerFilter)
        .populate('courseTypeId', 'name')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Career.countDocuments(careerFilter)
    ]);

    const data = careers.map((career) => ({
      ...career,
      courseTypeName: (career.courseTypeId as { name?: string } | null)?.name || ''
    }));

    return res.status(200).json({
      data,
      totalCount,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching vicedean careers:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getVicedeanCourseTypes = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const vicedean = await getVicedeanRecord(userId);
    if (!vicedean) {
      return res.status(404).json({ message: 'Vicedecano no encontrado' });
    }

    const facultyId = getFacultyIdFromVicedean(vicedean);
    if (!facultyId) {
      return res.status(404).json({ message: 'No se pudo determinar la facultad del vicedecano' });
    }

    const careers = await Career.find({ facultyId }).select('courseTypeId').lean();
    const courseTypeIds = [...new Set(careers.map((career) => career.courseTypeId?.toString()).filter(Boolean))];

    const courseTypes = await CourseType.find({
      _id: { $in: courseTypeIds },
      name: { $in: ['Curso Diurno', 'Curso por Encuentros'] }
    }).sort({ name: 1 }).lean();

    return res.status(200).json({
      data: courseTypes
    });
  } catch (error) {
    console.error('Error fetching vicedean course types:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getVicedeanSubjects = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const { careerId, academicYear, courseTypeId } = req.query;
    if (!careerId || !academicYear || !courseTypeId) {
      return res.status(400).json({ message: 'careerId, courseTypeId y academicYear son requeridos' });
    }

    const normalizedAcademicYear = Number(academicYear);
    if (Number.isNaN(normalizedAcademicYear) || normalizedAcademicYear < 1 || normalizedAcademicYear > 6) {
      return res.status(400).json({ message: 'academicYear debe estar entre 1 y 6' });
    }

    const vicedean = await getVicedeanRecord(userId);
    if (!vicedean) {
      return res.status(404).json({ message: 'Vicedecano no encontrado' });
    }

    const facultyId = getFacultyIdFromVicedean(vicedean);
    if (!facultyId) {
      return res.status(404).json({ message: 'No se pudo determinar la facultad del vicedecano' });
    }
    const career = await Career.findOne({ _id: careerId, facultyId, courseTypeId }).select('_id').lean();
    if (!career) {
      return res.status(404).json({ message: 'Carrera no encontrada para la combinación seleccionada' });
    }

    const page = parseInt(req.query.page as string, 10) || 0;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const skip = page * limit;

    const [subjects, totalCount] = await Promise.all([
      Subject.find({ careerId, academicYear: normalizedAcademicYear })
        .populate('professorId', 'firstName lastName')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Subject.countDocuments({ careerId, academicYear: normalizedAcademicYear })
    ]);

    const data = subjects.map((subject) => {
      const rawProfessor = subject.professorId as unknown;
      const professor = (
        rawProfessor && typeof rawProfessor === 'object' && 'firstName' in rawProfessor
          ? rawProfessor as { _id?: { toString(): string } | string; firstName?: string; lastName?: string }
          : null
      );

      const normalizedProfessorId = professor?._id
        ? typeof professor._id === 'string'
          ? professor._id
          : professor._id.toString()
        : null;

      return {
        ...subject,
        professorId: normalizedProfessorId,
        professorName: professor
          ? `${professor.firstName || ''} ${professor.lastName || ''}`.trim()
          : ''
      };
    });

    return res.status(200).json({
      data,
      totalCount,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching vicedean subjects:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const getVicedeanProfessors = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const vicedean = await getVicedeanRecord(userId);
    if (!vicedean) {
      return res.status(404).json({ message: 'Vicedecano no encontrado' });
    }

    const professorRole = await Role.findOne({ name: 'professor' }).select('_id').lean();
    if (!professorRole) {
      return res.status(404).json({ message: 'Rol de profesor no encontrado' });
    }

    const professors = await User.find({
      roleId: professorRole._id,
      isActive: true
    })
      .select('_id firstName lastName')
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    return res.status(200).json({
      data: professors.map((professor) => ({
        _id: professor._id,
        firstName: professor.firstName,
        lastName: professor.lastName
      }))
    });
  } catch (error) {
    console.error('Error fetching vicedean professors:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const assignProfessorToSubject = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const { subjectId } = req.params;
    const { professorId } = req.body as { professorId?: string };

    if (!subjectId || !professorId) {
      return res.status(400).json({ message: 'subjectId y professorId son requeridos' });
    }

    const vicedean = await getVicedeanRecord(userId);
    if (!vicedean) {
      return res.status(404).json({ message: 'Vicedecano no encontrado' });
    }

    const facultyId = getFacultyIdFromVicedean(vicedean);
    if (!facultyId) {
      return res.status(404).json({ message: 'No se pudo determinar la facultad del vicedecano' });
    }

    const subject = await Subject.findById(subjectId).select('_id careerId').lean();
    if (!subject) {
      return res.status(404).json({ message: 'Asignatura no encontrada' });
    }

    const subjectCareer = await Career.findOne({
      _id: subject.careerId,
      facultyId
    })
      .select('_id')
      .lean();

    if (!subjectCareer) {
      return res.status(403).json({ message: 'No tienes permisos para modificar esta asignatura' });
    }

    const professorRole = await Role.findOne({ name: 'professor' }).select('_id').lean();
    if (!professorRole) {
      return res.status(404).json({ message: 'Rol de profesor no encontrado' });
    }

    const professor = await User.findOne({
      _id: professorId,
      roleId: professorRole._id,
      isActive: true
    })
      .select('_id')
      .lean();

    if (!professor) {
      return res.status(404).json({ message: 'Profesor no encontrado o inactivo' });
    }

    const updatedSubject = await Subject.findByIdAndUpdate(
      subjectId,
      { professorId },
      { new: true }
    )
      .populate('professorId', 'firstName lastName')
      .select('_id name professorId')
      .lean();

    return res.status(200).json({
      message: 'Profesor asignado correctamente',
      data: updatedSubject
    });
  } catch (error) {
    console.error('Error assigning professor to subject:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};
