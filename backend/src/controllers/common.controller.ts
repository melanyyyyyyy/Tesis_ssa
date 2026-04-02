import { Request, Response } from 'express';
import { UserModel, ExamCalendarModel } from '../models/system/index.js';
import { StudentModel, SubjectModel, ExaminationTypeModel } from '../models/sigenu/index.js';
import NotificationModel from '../models/system/Notification.js';


export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const user = await UserModel.findById(userId)
      .populate('roleId', 'name')
      .populate('studentId')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const profileData = {
      id: user._id,
      email: user.email,
      identification: user.identification,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.roleId,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };

    if (user.studentId) {
      const student = await StudentModel.findById(user.studentId)
        .populate('careerId', 'name')
        .populate('courseTypeId', 'name')
        .populate('studentStatusId', 'kind')
        .lean();

      if (student) {
        (profileData as any).student = {
          career: student.careerId,
          courseType: student.courseTypeId,
          academicYear: student.academicYear,
          studentStatus: student.studentStatusId
        };
      }
    }

    res.json(profileData);
  } catch (error) {
    console.error('Error obtaining user profile:', error);
    res.status(500).json({ message: 'Error obtaining user profile.' });
  }
};

export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const notifications = await NotificationModel.find({
      recipientId: userId
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await NotificationModel.countDocuments({
      recipientId: userId,
      isRead: false
    });

    res.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error obtaining user notifications:', error);
    res.status(500).json({ message: 'Error obtaining user notifications.' });
  }
};

// Endpoints para los ExamCalendar

export const getExamCalendarEvents = async (req: Request, res: Response) => {
  try {
    const { careerId, academicYear } = req.query;

    if (!careerId || typeof careerId !== 'string') {
      return res.status(400).json({ message: 'careerId is required.' });
    }

    const subjectQuery: Record<string, unknown> = { careerId };

    if (academicYear && typeof academicYear === 'string') {
      const parsedAcademicYear = Number(academicYear);
      if (Number.isNaN(parsedAcademicYear)) {
        return res.status(400).json({ message: 'academicYear must be a valid number.' });
      }
      subjectQuery.academicYear = parsedAcademicYear;
    }

    const subjects = await SubjectModel.find(subjectQuery).select('_id').lean();
    const subjectIds = subjects.map((subject) => subject._id);

    if (subjectIds.length === 0) {
      return res.json({ events: [] });
    }

    const events = await ExamCalendarModel.find({
      careerId,
      subjectId: { $in: subjectIds }
    })
      .populate('subjectId', 'name')
      .populate('examinationTypeId', 'name')
      .sort({ examDate: 1 })
      .lean();

    res.json({ events });
  } catch (error) {
    console.error('Error obtaining exam calendar events:', error);
    res.status(500).json({ message: 'Error obtaining exam calendar events.' });
  }
};

export const getSubjectsByCareer = async (req: Request, res: Response) => {
  try {
    const { careerId, academicYear } = req.query;

    if (!careerId || typeof careerId !== 'string') {
      return res.status(400).json({ message: 'careerId is required.' });
    }

    const subjectQuery: Record<string, unknown> = { careerId };
    if (academicYear && typeof academicYear === 'string') {
      const parsedAcademicYear = Number(academicYear);
      if (Number.isNaN(parsedAcademicYear)) {
        return res.status(400).json({ message: 'academicYear must be a valid number.' });
      }
      subjectQuery.academicYear = parsedAcademicYear;
    }

    const subjects = await SubjectModel.find(subjectQuery)
      .select('_id name academicYear')
      .sort({ academicYear: 1, name: 1 })
      .lean();

    res.json({ subjects });
  } catch (error) {
    console.error('Error obtaining subjects by career:', error);
    res.status(500).json({ message: 'Error obtaining subjects by career.' });
  }
};

export const getExaminationTypes = async (_req: Request, res: Response) => {
  try {
    const examinationTypes = await ExaminationTypeModel.find()
      .select('_id name priority')
      .sort({ priority: 1, name: 1 })
      .lean();

    res.json({ examinationTypes });
  } catch (error) {
    console.error('Error obtaining examination types:', error);
    res.status(500).json({ message: 'Error obtaining examination types.' });
  }
};

export const createExamCalendarEvent = async (req: Request, res: Response) => {
  try {
    const { careerId, subjectId, examinationTypeId, examDate } = req.body;

    if (!careerId || !subjectId || !examinationTypeId || !examDate) {
      return res.status(400).json({ message: 'careerId, subjectId, examinationTypeId and examDate are required.' });
    }

    const createdEvent = await ExamCalendarModel.create({
      careerId,
      subjectId,
      examinationTypeId,
      examDate
    });

    const populatedEvent = await ExamCalendarModel.findById(createdEvent._id)
      .populate('subjectId', 'name')
      .populate('examinationTypeId', 'name')
      .lean();

    res.status(201).json({ event: populatedEvent });
  } catch (error) {
    console.error('Error creating exam calendar event:', error);
    const message = error instanceof Error ? error.message : 'Error creating exam calendar event.';
    res.status(400).json({ message });
  }
};

export const deleteExamCalendarEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const subjectId = req.body;

    if (subjectId) {
      const examEvent = await ExamCalendarModel.findById(id);

      if (!examEvent) {
        return res.status(404).json({ message: 'Exam calendar event not found.' });
      }

      if (examEvent.subjectId.toString() !== subjectId) {
        return res.status(403).json({
          message: 'No tienes los permisos para borrar este examen porque no pertenece a la asignatura especificada.'
        });
      }
    }

    const deleted = await ExamCalendarModel.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: 'Exam calendar event not found.' });
    }

    res.json({ message: 'Exam calendar event deleted successfully.' });
  } catch (error) {
    console.error('Error deleting exam calendar event:', error);
    res.status(500).json({ message: 'Error deleting exam calendar event.' });
  }
};
