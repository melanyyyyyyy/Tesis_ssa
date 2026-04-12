import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel, RoleModel } from '../models/system/index.js';
import { StudentModel, StudentStatusModel, FacultyModel } from '../models/sigenu/index.js';
import RoleRequestModel from '../models/system/RoleRequest.js';
import { ENV } from '../config/envs.js';

export const generateToken = (user: any, roleName?: string): string => {
    const role = roleName || (user.roleId && user.roleId.name ? user.roleId.name : user.roleId);
    const payload = {
        id: user._id,
        email: user.email,
        role: role,
        identification: user.identification
    };

    return jwt.sign(payload, ENV.JWT_SECRET, {
        expiresIn: ENV.JWT_EXPIRES as any,
        algorithm: 'HS256'
    });
};

export const AuthController = {
    async login(req: Request, res: Response): Promise<void> {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        if (ENV.NODE_ENV !== 'production' && (username === 'test_secretary' || username === 'test_professor' || username === 'test_vicedean' || username === 'test_admin')) {
            try {
                if (password !== ENV.TEST_USER_PASSWORD) {
                    res.status(401).json({ error: 'Invalid password for test user' });
                    return;
                }

                const user = await UserModel.findOne({ email: username }).populate('roleId');
                if (user && user.roleId) {
                    const roleName = (user.roleId as any).name;
                    const token = generateToken(user, roleName);
                    res.json({
                        message: 'Login successful (Test User)',
                        token,
                        user: {
                            _id: user._id,
                            firstName: user.firstName,
                            lastName: user.lastName,
                            email: user.email,
                            role: roleName
                        }
                    });
                    return;
                }
            } catch (error) {
                console.error('Test user login error:', error);
            }
        }

        try {
            /*
            const apiResponse = await fetch('https://auth.uho.edu.cu/login', {
                method: 'POST',
                headers: {
                    "Origin": "https://auth.uho.edu.cu",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Authorization": ENV.EXTERNAL_AUTH_TOKEN
                },
                body: JSON.stringify({ username, password })
            });
    
            const data: any = await apiResponse.json();

            if (!data.OK || !data.activeUser) {
                res.status(401).json({ error: 'Authentication failed with external provider' });
                return;
            }
            */

            const data: any = {
                activeUser: {
                    status: 200,
                    account_state: "FALSE",
                    uid: "melanyrr",
                    personal_information: {
                        dni: "04121279213",
                        cn: "Mélany Marian Ricardo Rodríguez",
                        given_name: "Mélany Marian",
                        sn: "Ricardo Rodríguez",
                        personal_photo: "",
                        overlapping: ""
                    },
                    account_info: {
                        user_type: "Trabajador",
                        create_user: "AGA [mvelazquezm]",
                        create_date: "2023-02-23 09:17:44 am",
                        modify_user: "AGA",
                        modify_data: "2025-12-29 11:59:03 pm",
                        accept_system_policies: true,
                        password: {
                            user_password_set: "2025-09-30 12:07:48 pm",
                            pass_valid: "Expirado",
                            pass_set: "114"
                        }
                    },
                    message: "Inició sesión"
                }
            };

            const { personal_information, uid } = data.activeUser;
            const dni = personal_information.dni;
            const firstName = personal_information.given_name;
            const lastName = personal_information.sn;

            let student = await StudentModel.findOne({ identification: dni, isActive: true });
            let roleIdToAssign = undefined;

            if (student) {
                const studentStatus = await StudentStatusModel.findById(student.studentStatusId).lean();
                const canAssignStudentRole = studentStatus
                    && studentStatus.kind !== 'Baja'
                    && studentStatus.kind !== 'Egresado';

                if (canAssignStudentRole) {
                    student.email = uid;
                    await student.save();

                    const studentRole = await RoleModel.findOne({ name: 'student' });
                    if (!studentRole) {
                        res.status(500).json({ error: 'System error: Student role not defined' });
                        return;
                    }
                    roleIdToAssign = studentRole._id;
                } else {
                    student = null;
                }
            }

            let user = await UserModel.findOne({ identification: dni });

            if (!user) {
                user = new UserModel({
                    email: uid,
                    identification: dni,
                    firstName,
                    lastName,
                    roleId: roleIdToAssign,
                    studentId: student ? student._id : undefined,
                    isActive: true
                });
            } else {
                user.email = uid;
                user.firstName = firstName;
                user.lastName = lastName;
                user.isActive = true;
                if (student) user.studentId = student._id;
                if (roleIdToAssign) user.roleId = roleIdToAssign;
            }

            await user.save();

            if (!user.roleId) {
                if (user.accessDenied) {
                    res.status(403).json({
                        message: 'Su solicitud de rol fue rechazada. Contacte con un administrador si necesita mas información.',
                        userCreated: true,
                        requiresRoleRequest: false,
                        hasPendingRoleRequest: false,
                        hasRejectedRoleRequest: true,
                        pendingRoleRequest: null,
                        userId: String(user._id)
                    });
                    return;
                }

                const pendingRoleRequest = await RoleRequestModel.findOne({
                    user: user._id,
                    status: 'pending'
                } as any)
                    .populate('requestedRole', 'name')
                    .populate('faculty', 'name')
                    .lean();

                res.status(403).json({
                    message: pendingRoleRequest
                        ? 'Usted ya tiene una solicitud de rol pendiente por aprobar. Vuelva más tarde.'
                        : 'Usted aun no se encuentra registrado en el sistema.',
                    userCreated: true,
                    requiresRoleRequest: !pendingRoleRequest,
                    hasPendingRoleRequest: !!pendingRoleRequest,
                    pendingRoleRequest: pendingRoleRequest ? {
                        _id: String(pendingRoleRequest._id),
                        requestedRole: (pendingRoleRequest.requestedRole as any)?.name || '',
                        faculty: pendingRoleRequest.faculty
                            ? {
                                _id: String((pendingRoleRequest.faculty as any)?._id || ''),
                                name: (pendingRoleRequest.faculty as any)?.name || ''
                            }
                            : null
                    } : null,
                    userId: String(user._id)
                });
                return;
            }

            await user.populate('roleId');
            const roleName = (user.roleId as any).name;

            const token = generateToken(user, roleName);
            res.json({
                message: 'Login successful',
                token,
                user: {
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    role: roleName
                }
            });

        } catch (error: any) {
            console.error('Login error:', error);

            const errorCode = error.cause?.code || error.code;

            if (errorCode === 'ENOTFOUND') {
                res.status(503).json({
                    message: 'No se pudo conectar con auth.uho.edu.cu'
                });
                return;
            }

            if (errorCode === 'UND_ERR_CONNECT_TIMEOUT' || errorCode === 'ETIMEDOUT') {
                res.status(504).json({
                    message: 'El servidor de autenticación de la UHo tardó demasiado en responder. Por favor, revisa tu conexión o la VPN.'
                });
                return;
            }

            if (errorCode === 'ETIMEDOUT') {
                res.status(504).json({
                    message: 'El servidor de la universidad tardó demasiado en responder.'
                });
                return;
            }

            res.status(500).json({
                error: 'Internal error.',
                details: error.message
            });
            return;
        }
    },

    async getFaculties(_req: Request, res: Response): Promise<void> {
        try {
            const faculties = await FacultyModel.find()
                .select('_id name')
                .sort({ name: 1 })
                .lean();

            res.status(200).json({
                data: faculties.map((faculty) => ({
                    _id: String(faculty._id),
                    name: faculty.name
                }))
            });
        } catch (error: any) {
            console.error('Get faculties for auth error:', error);
            res.status(500).json({
                error: 'No se pudieron cargar las facultades.',
                details: error.message
            });
        }
    },

    async createRoleRequest(req: Request, res: Response): Promise<void> {
        try {
            const { userId, facultyId, requestedRole } = req.body as {
                userId?: string;
                facultyId?: string;
                requestedRole?: string;
            };
            const rolesRequiringFaculty = new Set(['secretary', 'vicedean', 'professor']);
            const allowedRoles = new Set(['admin', 'secretary', 'vicedean', 'professor']);

            if (!userId || !requestedRole) {
                res.status(400).json({ error: 'userId y requestedRole son requeridos.' });
                return;
            }

            if (!allowedRoles.has(requestedRole)) {
                res.status(400).json({ error: 'El rol solicitado no es válido.' });
                return;
            }

            if (rolesRequiringFaculty.has(requestedRole) && !facultyId) {
                res.status(400).json({ error: 'Debe seleccionar una facultad para el rol solicitado.' });
                return;
            }

            const [user, faculty, roleDocument] = await Promise.all([
                UserModel.findById(userId).select('_id roleId accessDenied').lean(),
                facultyId ? FacultyModel.findById(facultyId).select('_id').lean() : Promise.resolve(null),
                RoleModel.findOne({ name: requestedRole }).select('_id').lean()
            ]);

            if (!user) {
                res.status(404).json({ error: 'Usuario no encontrado.' });
                return;
            }

            if (user.roleId) {
                res.status(409).json({ error: 'El usuario ya tiene un rol asignado.' });
                return;
            }

            if (user.accessDenied) {
                res.status(403).json({
                    error: 'Su solicitud anterior fue rechazada. No puede enviar una nueva solicitud en este momento.',
                    hasRejectedRoleRequest: true
                });
                return;
            }

            if (rolesRequiringFaculty.has(requestedRole) && !faculty) {
                res.status(404).json({ error: 'La facultad seleccionada no existe.' });
                return;
            }

            if (!roleDocument?._id) {
                res.status(500).json({ error: 'El rol solicitado no está configurado en el sistema.' });
                return;
            }

            const existingPendingRequestForUser = await RoleRequestModel.findOne({
                user: user._id,
                status: 'pending'
            } as any)
                .populate('requestedRole', 'name')
                .populate('faculty', 'name')
                .lean();

            if (existingPendingRequestForUser) {
                res.status(409).json({
                    error: 'Ya existe una solicitud pendiente para este usuario.',
                    hasPendingRoleRequest: true,
                    pendingRoleRequest: {
                        _id: String(existingPendingRequestForUser._id),
                        requestedRole: (existingPendingRequestForUser.requestedRole as any)?.name || '',
                        faculty: existingPendingRequestForUser.faculty
                            ? {
                                _id: String((existingPendingRequestForUser.faculty as any)?._id || ''),
                                name: (existingPendingRequestForUser.faculty as any)?.name || ''
                            }
                            : null
                    }
                });
                return;
            }

            const roleRequestPayload = {
                user: user._id,
                faculty: faculty?._id ?? null,
                requestedRole: roleDocument._id,
                status: 'pending'
            } as any;

            await RoleRequestModel.create(roleRequestPayload);

            res.status(201).json({
                message: 'Solicitud enviada correctamente. Un administrador revisará su registro.'
            });
        } catch (error: any) {
            console.error('Create role request error:', error);
            res.status(500).json({
                error: 'No se pudo registrar la solicitud.',
                details: error.message
            });
        }
    }
};
