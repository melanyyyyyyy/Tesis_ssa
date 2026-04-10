import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel, RoleModel } from '../models/system/index.js';
import { StudentModel } from '../models/sigenu/index.js';
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

            const { personal_information, uid } = data.activeUser;
            const dni = personal_information.dni;
            const firstName = personal_information.given_name;
            const lastName = personal_information.sn;

            let student = await StudentModel.findOne({ identification: dni });
            let roleIdToAssign = undefined;

            if (student) {
                student.email = uid;
                await student.save();

                const studentRole = await RoleModel.findOne({ name: 'student' });
                if (!studentRole) {
                    res.status(500).json({ error: 'System error: Student role not defined' });
                    return;
                }
                roleIdToAssign = studentRole._id;
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
                res.status(403).json({
                    message: 'User created but no role assigned. Please contact administration.',
                    userCreated: true
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
    }
};