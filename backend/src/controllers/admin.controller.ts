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
    SubjectModel
} from '../models/sigenu/index.js';
import {
    EvaluationScoreModel,
    RoleModel,
    RoleRequestModel,
    SecretaryModel,
    UserModel,
    VicedeanModel
} from '../models/system/index.js';
import { ENV } from '../config/envs.js';
import { SyncService } from '../services/sync.service.js';

async function getFilteredCareerIds(options?: {
    facultyId?: string;
    courseTypeId?: string;
    careerId?: string;
}) {
    const filter: Record<string, unknown> = {};

    if (options?.facultyId) {
        filter.facultyId = options.facultyId;
    }
    if (options?.courseTypeId) {
        filter.courseTypeId = options.courseTypeId;
    }
    if (options?.careerId) {
        filter._id = options.careerId;
    }

    const careers = await CareerModel.find(filter).select('_id').lean();
    return careers.map((career) => career._id);
}

async function getSubjectIdsByCareerIds(careerIds: Types.ObjectId[]) {
    if (careerIds.length === 0) {
        return [];
    }

    const subjects = await SubjectModel.find({ careerId: { $in: careerIds } }).select('_id').lean();
    return subjects.map((subject) => subject._id);
}

const TEST_USER_PASSWORD = ENV.TEST_USER_PASSWORD;
const TEST_FACULTY_SIGEN_ID = '06';
const TEST_SUBJECT_SIGEN_ID = '-591e423f:16585e8c5ee:-28e3'; // matematica 4
const TEST_CAREER_SIGEN_ID = '0601';
const TEST_USER_ORDER = ['test_admin', 'test_secretary', 'test_vicedean', 'test_professor', 'test_student'] as const;
const SIGENU_IMPORT_REQUIRED_MESSAGE = 'No se encontraron los datos base para crear los usuarios de prueba. Primero debe importar los datos del SIGENU en la pagina de importación.';

type TestUsername = (typeof TEST_USER_ORDER)[number];
type TestRoleName = 'admin' | 'secretary' | 'vicedean' | 'professor' | 'student';

interface EnsureTestUserParams {
    username: TestUsername;
    identification: string;
    firstName: string;
    lastName: string;
    roleId: Types.ObjectId;
    studentId?: Types.ObjectId;
}

async function getRequiredTestSigenuData() {
    const [faculty, subject, career] = await Promise.all([
        FacultyModel.findOne({ sigenId: TEST_FACULTY_SIGEN_ID }).select('_id name sigenId').lean(),
        SubjectModel.findOne({ sigenId: TEST_SUBJECT_SIGEN_ID }).select('_id name sigenId').lean(),
        CareerModel.findOne({ sigenId: TEST_CAREER_SIGEN_ID }).select('_id name sigenId').lean()
    ]);

    if (!faculty || !subject || !career) {
        throw new Error(SIGENU_IMPORT_REQUIRED_MESSAGE);
    }

    const student = await StudentModel.findOne({
        careerId: career._id,
        academicYear: 2,
        isActive: true
    })
        .select('_id identification firstName lastName')
        .sort({ firstName: 1, lastName: 1 })
        .lean();

    if (!student) {
        throw new Error(SIGENU_IMPORT_REQUIRED_MESSAGE);
    }

    return { faculty, subject, career, student };
}

async function ensureTestUser({
    username,
    identification,
    firstName,
    lastName,
    roleId,
    studentId
}: EnsureTestUserParams) {
    const [existingByEmail, existingByIdentification] = await Promise.all([
        UserModel.findOne({ email: username }),
        UserModel.findOne({ identification })
    ]);

    let user = existingByIdentification || existingByEmail;
    let created = false;

    if (existingByEmail && existingByIdentification && String(existingByEmail._id) !== String(existingByIdentification._id)) {
        existingByEmail.email = undefined;
        await existingByEmail.save();
        user = existingByIdentification;
    }

    if (!user) {
        user = new UserModel({
            email: username,
            identification,
            firstName,
            lastName,
            roleId,
            studentId,
            isActive: true,
            accessDenied: false
        });
        created = true;
    } else {
        user.email = username;
        user.identification = identification;
        user.firstName = firstName;
        user.lastName = lastName;
        user.roleId = roleId;
        user.studentId = studentId;
        user.isActive = true;
        user.accessDenied = false;
    }

    await user.save();

    return { user, created };
}

async function getTestUsersData() {
    const users = await UserModel.find({
        email: { $in: [...TEST_USER_ORDER] }
    })
        .populate('roleId', 'name')
        .sort({ firstName: 1, lastName: 1 })
        .lean();

    const userIds = users.map((user) => user._id);
    const [secretaryAssignments, vicedeanAssignments] = await Promise.all([
        SecretaryModel.find({ userId: { $in: userIds } }).populate('facultyId', 'name').lean(),
        VicedeanModel.find({ userId: { $in: userIds } }).populate('facultyId', 'name').lean()
    ]);

    const secretaryFacultyByUserId = new Map(
        secretaryAssignments.map((assignment) => [
            String(assignment.userId),
            ((assignment.facultyId as any)?.name || '-') as string
        ])
    );
    const vicedeanFacultyByUserId = new Map(
        vicedeanAssignments.map((assignment) => [
            String(assignment.userId),
            ((assignment.facultyId as any)?.name || '-') as string
        ])
    );
    const usersByEmail = new Map(users.map((user) => [String(user.email || ''), user]));

    return TEST_USER_ORDER.flatMap((username) => {
        const user = usersByEmail.get(username);
        if (!user) {
            return [];
        }

        const roleName = ((user.roleId as any)?.name || '') as TestRoleName | '';
        const userId = String(user._id);
        const faculty = roleName === 'secretary'
            ? secretaryFacultyByUserId.get(userId) || '-'
            : roleName === 'vicedean'
                ? vicedeanFacultyByUserId.get(userId) || '-'
                : '-';

        return [{
            _id: userId,
            username,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            identification: user.identification || '',
            email: username,
            password: TEST_USER_PASSWORD,
            faculty,
            role: roleName || 'sin_rol'
        }];
    });
}

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

export async function getRoleManagementUsers(req: Request, res: Response) {
    try {
        const statusParam = typeof req.query.status === 'string' ? req.query.status : 'all';
        const status = ['pending', 'assigned', 'all', 'role_requests'].includes(statusParam) ? statusParam : 'all';
        const allowedRoleNames = ['admin', 'secretary', 'vicedean', 'professor'];

        const allowedRoles = await RoleModel.find({ name: { $in: allowedRoleNames } })
            .select('_id name')
            .lean();

        const allowedRoleIds = allowedRoles.map((role) => role._id);

        let filter: any = {};
        if (status === 'pending') {
            filter = { roleId: null };
        } else if (status === 'assigned') {
            filter = { roleId: { $in: allowedRoleIds } };
        } else if (status === 'all') {
            filter = {
                $or: [
                    { roleId: null },
                    { roleId: { $in: allowedRoleIds } }
                ]
            };
        }

        const pendingRequests = await RoleRequestModel.find({ status: 'pending' })
            .populate('requestedRole', 'name')
            .populate('faculty', 'name')
            .lean();

        const pendingRequestsMap = new Map(
            pendingRequests.map((request: any) => [String(request.user), request])
        );

        let users: any[] = [];
        if (status === 'role_requests') {
            const userIdsWithRequests = pendingRequests.map((req: any) => req.user);
            users = await UserModel.find({ _id: { $in: userIdsWithRequests } })
                .populate('roleId', 'name')
                .sort({ firstName: 1, lastName: 1 })
                .lean();
        } else {
            users = await UserModel.find(filter)
                .populate('roleId', 'name')
                .sort({ firstName: 1, lastName: 1 })
                .lean();
        }

        if (status === 'pending') {
            users = users.filter((user) => !pendingRequestsMap.has(String(user._id)));
        }

        const userIds = users.map((user) => user._id);
        const [secretaryAssignments, vicedeanAssignments] = await Promise.all([
            SecretaryModel.find({ userId: { $in: userIds } })
                .populate('facultyId', 'name')
                .lean(),
            VicedeanModel.find({ userId: { $in: userIds } })
                .populate('facultyId', 'name')
                .lean()
        ]);

        const secretaryAssignmentsMap = new Map(
            secretaryAssignments.map((assignment) => [String(assignment.userId), assignment])
        );
        const vicedeanAssignmentsMap = new Map(
            vicedeanAssignments.map((assignment) => [String(assignment.userId), assignment])
        );

        const data = users.map((user) => {
            const role = user.roleId as { name?: string } | null;
            const secretaryAssignment = secretaryAssignmentsMap.get(String(user._id));
            const vicedeanAssignment = vicedeanAssignmentsMap.get(String(user._id));
            const pendingRequest = pendingRequestsMap.get(String(user._id)) as any;

            let assignedFaculty =
                role?.name === 'secretary'
                    ? secretaryAssignment?.facultyId as { _id?: string; name?: string } | undefined
                    : role?.name === 'vicedean'
                        ? vicedeanAssignment?.facultyId as { _id?: string; name?: string } | undefined
                        : undefined;
 
            if (pendingRequest) {
                assignedFaculty = pendingRequest.faculty;
            }
 
            return {
                _id: user._id,
                requestId: pendingRequest?._id || null,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: `${user.firstName} ${user.lastName}`.trim(),
                email: user.email || '',
                role: pendingRequest ? pendingRequest.requestedRole.name : (role?.name || null),
                isPendingApproval: !!pendingRequest,
                accessDenied: !!user.accessDenied,
                faculty: assignedFaculty
                    ? {
                        _id: String(assignedFaculty._id || ''),
                        name: assignedFaculty.name || ''
                    }
                    : null
            };
        });

        return res.status(200).json({
            data,
            totalCount: data.length,
            status
        });
    } catch (error: any) {
        console.error('Error in getRoleManagementUsers:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get role management users.'
        });
    }
}

export async function approveRoleRequest(req: Request, res: Response) {
    try {
        const { requestId } = req.params;
        const request = await RoleRequestModel.findById(requestId)
            .populate('user')
            .populate('requestedRole')
            .populate('faculty');

        if (!request) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        const requestUser = request.user as any;
        const requestedRole = request.requestedRole as any;
        const requestFaculty = request.faculty as any;

        const user = await UserModel.findById(requestUser._id);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const roleName = requestedRole.name;
        user.roleId = requestedRole._id;
        user.accessDenied = false; 
        await user.save();

        if (roleName === 'secretary') {
            await VicedeanModel.deleteOne({ userId: user._id });
            if (requestFaculty?._id) {
                await SecretaryModel.findOneAndUpdate(
                    { userId: user._id },
                    { userId: user._id, facultyId: requestFaculty._id },
                    { upsert: true, new: true }
                );
            }
        } else if (roleName === 'vicedean') {
            await SecretaryModel.deleteOne({ userId: user._id });
            if (requestFaculty?._id) {
                await VicedeanModel.findOneAndUpdate(
                    { userId: user._id },
                    { userId: user._id, facultyId: requestFaculty._id },
                    { upsert: true, new: true }
                );
            }
        } else {
            await Promise.all([
                SecretaryModel.deleteOne({ userId: user._id }),
                VicedeanModel.deleteOne({ userId: user._id })
            ]);
        }

        request.status = 'reviewed';
        await request.save();

        return res.status(200).json({ success: true, message: 'Solicitud aprobada correctamente' });
    } catch (error: any) {
        console.error('Error in approveRoleRequest:', error);
        return res.status(500).json({ message: 'Error al aprobar solicitud', error: error.message });
    }
}

export async function rejectRoleRequest(req: Request, res: Response) {
    try {
        const { requestId } = req.params;
        const request = await RoleRequestModel.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        const user = await UserModel.findById(request.user);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        user.accessDenied = true;
        await user.save();

        await RoleRequestModel.findByIdAndDelete(requestId);

        return res.status(200).json({ success: true, message: 'Solicitud rechazada correctamente' });
    } catch (error: any) {
        console.error('Error in rejectRoleRequest:', error);
        return res.status(500).json({ message: 'Error al rechazar solicitud', error: error.message });
    }
}

export async function getFacultyAssignmentUsers(req: Request, res: Response) {
    try {
        const tabParam = typeof req.query.tab === 'string' ? req.query.tab : 'all';
        const tab = ['secretaries', 'vicedeans', 'all'].includes(tabParam) ? tabParam : 'all';
        const allowedRoleNames = ['secretary', 'vicedean'];

        const allowedRoles = await RoleModel.find({ name: { $in: allowedRoleNames } })
            .select('_id name')
            .lean();

        const roleIdByName = new Map(
            allowedRoles.map((role) => [role.name, role._id])
        );
        const filter =
            tab === 'secretaries'
                ? { roleId: roleIdByName.get('secretary') }
                : tab === 'vicedeans'
                    ? { roleId: roleIdByName.get('vicedean') }
                    : { roleId: { $in: allowedRoles.map((role) => role._id) } };

        const users = await UserModel.find(filter)
            .populate('roleId', 'name')
            .sort({ firstName: 1, lastName: 1 })
            .lean();

        const userIds = users.map((user) => user._id);
        const [secretaryAssignments, vicedeanAssignments] = await Promise.all([
            SecretaryModel.find({ userId: { $in: userIds } })
                .populate('facultyId', 'name')
                .lean(),
            VicedeanModel.find({ userId: { $in: userIds } })
                .populate('facultyId', 'name')
                .lean()
        ]);

        const secretaryAssignmentsMap = new Map(
            secretaryAssignments.map((assignment) => [String(assignment.userId), assignment])
        );
        const vicedeanAssignmentsMap = new Map(
            vicedeanAssignments.map((assignment) => [String(assignment.userId), assignment])
        );

        const data = users.map((user) => {
            const role = user.roleId as { name?: string } | null;
            const assignedFaculty =
                role?.name === 'secretary'
                    ? secretaryAssignmentsMap.get(String(user._id))?.facultyId as { _id?: string; name?: string } | undefined
                    : vicedeanAssignmentsMap.get(String(user._id))?.facultyId as { _id?: string; name?: string } | undefined;

            return {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: `${user.firstName} ${user.lastName}`.trim(),
                email: user.email || '',
                role: role?.name || null,
                faculty: assignedFaculty
                    ? {
                        _id: String(assignedFaculty._id || ''),
                        name: assignedFaculty.name || ''
                    }
                    : null
            };
        });

        return res.status(200).json({
            data,
            totalCount: data.length,
            tab
        });
    } catch (error: any) {
        console.error('Error in getFacultyAssignmentUsers:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get faculty assignment users.'
        });
    }
}

export async function updateRoleManagementUser(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const rawRole = req.body.role;
        const rawFacultyId = req.body.facultyId;
        const role = rawRole === null || rawRole === '' ? null : String(rawRole);
        const facultyId = rawFacultyId === null || rawFacultyId === '' ? null : String(rawFacultyId);
        const allowedRoleNames = ['admin', 'secretary', 'vicedean', 'professor'];

        if (role !== null && !allowedRoleNames.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Rol no permitido'
            });
        }

        const user = await UserModel.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        if (facultyId) {
            const facultyExists = await FacultyModel.exists({ _id: facultyId });
            if (!facultyExists) {
                return res.status(404).json({
                    success: false,
                    message: 'La facultad seleccionada no existe'
                });
            }
        }

        const roleDocument = role ? await RoleModel.findOne({ name: role }).select('_id name') : null;
        if (role && !roleDocument) {
            return res.status(404).json({
                success: false,
                message: 'No se encontro el rol seleccionado'
            });
        }

        user.roleId = roleDocument?._id ?? null;
        
        if (roleDocument) {
            user.accessDenied = false;
        }
        
        await user.save();

        if (role === 'secretary') {
            await VicedeanModel.deleteOne({ userId: user._id });
            if (facultyId) {
                await SecretaryModel.findOneAndUpdate(
                    { userId: user._id },
                    { userId: user._id, facultyId },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            } else {
                await SecretaryModel.deleteOne({ userId: user._id });
            }
        } else if (role === 'vicedean') {
            await SecretaryModel.deleteOne({ userId: user._id });
            if (facultyId) {
                await VicedeanModel.findOneAndUpdate(
                    { userId: user._id },
                    { userId: user._id, facultyId },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            } else {
                await VicedeanModel.deleteOne({ userId: user._id });
            }
        } else {
            await Promise.all([
                SecretaryModel.deleteOne({ userId: user._id }),
                VicedeanModel.deleteOne({ userId: user._id })
            ]);
        }

        const updatedUser = await UserModel.findById(user._id)
            .populate('roleId', 'name')
            .lean();

        const currentRole = updatedUser?.roleId as { name?: string } | null | undefined;
        const currentFacultyAssignment =
            currentRole?.name === 'secretary'
                ? await SecretaryModel.findOne({ userId: user._id }).populate('facultyId', 'name').lean()
                : currentRole?.name === 'vicedean'
                    ? await VicedeanModel.findOne({ userId: user._id }).populate('facultyId', 'name').lean()
                    : null;
        const assignedFaculty = currentFacultyAssignment?.facultyId as { _id?: string; name?: string } | undefined;

        return res.status(200).json({
            success: true,
            message: 'Rol actualizado correctamente',
            data: updatedUser ? {
                _id: updatedUser._id,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                fullName: `${updatedUser.firstName} ${updatedUser.lastName}`.trim(),
                email: updatedUser.email || '',
                role: currentRole?.name || null,
                faculty: assignedFaculty
                    ? {
                        _id: String(assignedFaculty._id || ''),
                        name: assignedFaculty.name || ''
                    }
                    : null
            } : null
        });
    } catch (error: any) {
        console.error('Error in updateRoleManagementUser:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to update role management user.'
        });
    }
}

export async function updateFacultyAssignmentUser(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const rawFacultyId = req.body.facultyId;
        const facultyId = rawFacultyId === null || rawFacultyId === '' ? null : String(rawFacultyId);

        const user = await UserModel.findById(id)
            .populate('roleId', 'name')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const currentRole = user.roleId as { name?: string } | null;
        if (currentRole?.name !== 'secretary' && currentRole?.name !== 'vicedean') {
            return res.status(400).json({
                success: false,
                message: 'Solo se puede editar la facultad de secretarios y vicedecanos'
            });
        }

        if (facultyId) {
            const facultyExists = await FacultyModel.exists({ _id: facultyId });
            if (!facultyExists) {
                return res.status(404).json({
                    success: false,
                    message: 'La facultad seleccionada no existe'
                });
            }
        }

        if (currentRole.name === 'secretary') {
            await VicedeanModel.deleteOne({ userId: user._id });
            if (facultyId) {
                await SecretaryModel.findOneAndUpdate(
                    { userId: user._id },
                    { userId: user._id, facultyId },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            } else {
                await SecretaryModel.deleteOne({ userId: user._id });
            }
        } else {
            await SecretaryModel.deleteOne({ userId: user._id });
            if (facultyId) {
                await VicedeanModel.findOneAndUpdate(
                    { userId: user._id },
                    { userId: user._id, facultyId },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            } else {
                await VicedeanModel.deleteOne({ userId: user._id });
            }
        }

        const updatedFacultyAssignment =
            currentRole.name === 'secretary'
                ? await SecretaryModel.findOne({ userId: user._id }).populate('facultyId', 'name').lean()
                : await VicedeanModel.findOne({ userId: user._id }).populate('facultyId', 'name').lean();
        const assignedFaculty = updatedFacultyAssignment?.facultyId as { _id?: string; name?: string } | undefined;

        return res.status(200).json({
            success: true,
            message: 'Facultad actualizada correctamente',
            data: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                fullName: `${user.firstName} ${user.lastName}`.trim(),
                email: user.email || '',
                role: currentRole.name || null,
                faculty: assignedFaculty
                    ? {
                        _id: String(assignedFaculty._id || ''),
                        name: assignedFaculty.name || ''
                    }
                    : null
            }
        });
    } catch (error: any) {
        console.error('Error in updateFacultyAssignmentUser:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to update faculty assignment user.'
        });
    }
}

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

///////////////////////////////
export async function getMatriculatedSubjects(req: Request, res: Response) {
    try {
        const { facultyId, studentId, courseTypeId, careerId, academicYear } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        let filter: any = {};

        const hasCareerScope = Boolean(facultyId || courseTypeId || careerId);
        if (hasCareerScope) {
            const careerIds = await getFilteredCareerIds({
                facultyId: typeof facultyId === 'string' ? facultyId : undefined,
                courseTypeId: typeof courseTypeId === 'string' ? courseTypeId : undefined,
                careerId: typeof careerId === 'string' ? careerId : undefined
            });
            const subjectIds = await getSubjectIdsByCareerIds(careerIds);
            filter.subjectId = { $in: subjectIds };
        }

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
        const { facultyId, courseTypeId, careerId, academicYear } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        let filter: any = {};

        if (careerId) {
            const careerFilter: Record<string, unknown> = { _id: careerId };
            if (facultyId) {
                careerFilter.facultyId = facultyId;
            }
            if (courseTypeId) {
                careerFilter.courseTypeId = courseTypeId;
            }

            const career = await CareerModel.findOne(careerFilter).select('_id').lean();
            if (!career) {
                return res.status(200).json({ data: [], totalCount: 0, page, limit });
            }

            filter.careerId = careerId;
        } else if (facultyId || courseTypeId) {
            const careerIds = await getFilteredCareerIds({
                facultyId: typeof facultyId === 'string' ? facultyId : undefined,
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
//////////////////
export async function getEvaluations(req: Request, res: Response) {
    try {
        const { facultyId, courseTypeId, careerId, academicYear, studentId } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        const matriculatedSubjectFilter: Record<string, unknown> = {};
        const hasCareerScope = Boolean(facultyId || courseTypeId || careerId);

        if (hasCareerScope) {
            const careerIds = await getFilteredCareerIds({
                facultyId: typeof facultyId === 'string' ? facultyId : undefined,
                courseTypeId: typeof courseTypeId === 'string' ? courseTypeId : undefined,
                careerId: typeof careerId === 'string' ? careerId : undefined
            });
            const subjectIds = await getSubjectIdsByCareerIds(careerIds);
            matriculatedSubjectFilter.subjectId = { $in: subjectIds };
        }

        if (studentId) {
            matriculatedSubjectFilter.studentId = studentId;
        } else if (academicYear) {
            matriculatedSubjectFilter.academicYear = academicYear;
        }

        let evaluationFilter: Record<string, unknown> = {};
        if (Object.keys(matriculatedSubjectFilter).length > 0) {
            const matriculatedSubjects = await MatriculatedSubjectModel.find(matriculatedSubjectFilter).select('_id').lean();
            evaluationFilter = {
                matriculatedSubjectId: { $in: matriculatedSubjects.map((matriculatedSubject) => matriculatedSubject._id) }
            };
        }

        const [evaluations, totalCount] = await Promise.all([
            EvaluationModel.find(evaluationFilter)
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
            EvaluationModel.countDocuments(evaluationFilter)
        ]);

        const evaluationsWithNames = await Promise.all(
            evaluations.map(async (evaluation) => {
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
        const { facultyId, courseTypeId, careerId, academicYear } = req.query;
        const page = parseInt(req.query.page as string) || 0;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = page * limit;

        const subjectFilter: Record<string, unknown> = {};
        if (facultyId || courseTypeId || careerId) {
            const careerIds = await getFilteredCareerIds({
                facultyId: typeof facultyId === 'string' ? facultyId : undefined,
                courseTypeId: typeof courseTypeId === 'string' ? courseTypeId : undefined,
                careerId: typeof careerId === 'string' ? careerId : undefined
            });
            subjectFilter.careerId = { $in: careerIds };
        }
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

export async function getTestUsers(_req: Request, res: Response) {
    try {
        const data = await getTestUsersData();

        return res.status(200).json({
            data,
            totalCount: data.length
        });
    } catch (error: any) {
        console.error('Error in getTestUsers:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function createTestUsers(_req: Request, res: Response) {
    try {
        const logs: string[] = [];
        const { faculty, subject, student } = await getRequiredTestSigenuData();

        logs.push(`Facultad base encontrada: ${faculty.name} (${TEST_FACULTY_SIGEN_ID}).`);
        logs.push(`Asignatura base encontrada: ${subject.name} (${TEST_SUBJECT_SIGEN_ID}).`);
        logs.push(`Estudiante base encontrado: ${student.firstName} ${student.lastName}.`);

        const roles = await RoleModel.find({
            name: { $in: ['admin', 'secretary', 'vicedean', 'professor', 'student'] }
        })
            .select('_id name')
            .lean();

        const roleMap = new Map(roles.map((role) => [role.name, role._id]));
        const adminRoleId = roleMap.get('admin');
        const secretaryRoleId = roleMap.get('secretary');
        const vicedeanRoleId = roleMap.get('vicedean');
        const professorRoleId = roleMap.get('professor');
        const studentRoleId = roleMap.get('student');

        if (!adminRoleId || !secretaryRoleId || !vicedeanRoleId || !professorRoleId || !studentRoleId) {
            return res.status(500).json({
                success: false,
                error: 'No estan configurados todos los roles requeridos para los usuarios de prueba.'
            });
        }

        const adminResult = await ensureTestUser({
            username: 'test_admin',
            identification: '10000000000',
            firstName: 'Administrador',
            lastName: 'De Prueba',
            roleId: adminRoleId
        });
        logs.push(adminResult.created
            ? 'Administrador de prueba creado.'
            : 'Administrador de prueba actualizado.');

        const secretaryResult = await ensureTestUser({
            username: 'test_secretary',
            identification: '10000000001',
            firstName: 'Secretario',
            lastName: 'De Prueba',
            roleId: secretaryRoleId
        });
        await SecretaryModel.findOneAndUpdate(
            { userId: secretaryResult.user._id },
            {
                userId: secretaryResult.user._id,
                facultyId: faculty._id
            },
            { upsert: true, new: true }
        );
        logs.push(secretaryResult.created
            ? `Secretario de prueba creado y vinculado a la facultad ${faculty.name}.`
            : `Secretario de prueba actualizado y vinculado a la facultad ${faculty.name}.`);

        const vicedeanResult = await ensureTestUser({
            username: 'test_vicedean',
            identification: '10000000002',
            firstName: 'Vicedeano',
            lastName: 'De Prueba',
            roleId: vicedeanRoleId
        });
        await VicedeanModel.findOneAndUpdate(
            { userId: vicedeanResult.user._id },
            {
                userId: vicedeanResult.user._id,
                facultyId: faculty._id
            },
            { upsert: true, new: true }
        );
        logs.push(vicedeanResult.created
            ? `Vicedecano de prueba creado y vinculado a la facultad ${faculty.name}.`
            : `Vicedecano de prueba actualizado y vinculado a la facultad ${faculty.name}.`);

        const professorResult = await ensureTestUser({
            username: 'test_professor',
            identification: '10000000003',
            firstName: 'Profesor',
            lastName: 'De Prueba',
            roleId: professorRoleId
        });
        await SubjectModel.findByIdAndUpdate(subject._id, {
            professorId: professorResult.user._id
        });
        logs.push(professorResult.created
            ? `Profesor de prueba creado y asignado a la asignatura ${subject.name}.`
            : `Profesor de prueba actualizado y asignado a la asignatura ${subject.name}.`);

        await StudentModel.findByIdAndUpdate(student._id, {
            email: 'test_student'
        });
        const studentResult = await ensureTestUser({
            username: 'test_student',
            identification: student.identification,
            firstName: student.firstName,
            lastName: student.lastName,
            roleId: studentRoleId,
            studentId: student._id
        });
        logs.push(studentResult.created
            ? `Estudiante de prueba creado a partir del registro ${student.firstName} ${student.lastName}.`
            : `Estudiante de prueba actualizado a partir del registro ${student.firstName} ${student.lastName}.`);

        const data = await getTestUsersData();

        return res.status(200).json({
            success: true,
            message: 'Usuarios de prueba creados o actualizados correctamente.',
            logs,
            data,
            totalCount: data.length
        });
    } catch (error: any) {
        console.error('Error in createTestUsers:', error);

        const statusCode = error.message === SIGENU_IMPORT_REQUIRED_MESSAGE ? 400 : 500;
        return res.status(statusCode).json({
            success: false,
            error: error.message
        });
    }
}
