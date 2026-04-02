import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel, RoleModel } from '../models/system/index.js';
import Student from '../models/sigenu/Student.js';
import { ENV } from '../config/envs.js'; 

export const generateToken = (user: any, roleName?: string): string => {
    const role = roleName || (user.roleId && user.roleId.name ? user.roleId.name : user.roleId);

    const payload = { 
        id: user._id, 
        email: user.email, 
        role: role,
        identification: user.identification
    };

    return jwt.sign(
        payload,
        ENV.JWT_SECRET,
        { 
            expiresIn: ENV.JWT_EXPIRES as any,
            algorithm: 'HS256' 
        }
    );
};

export const AuthController = {
    async login(req: Request, res: Response): Promise<void> {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        /////// Test User (Secretary)
        if (username === 'test_secretary' || username === 'test_professor') {
            try {
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

        ////////////

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
            console.log('Auth API Response:', data); 

            if (!data.OK || !data.activeUser) {
                 res.status(401).json({ error: 'Authentication failed with external provider' });
                 return;
            }

            const { personal_information, account_info, uid } = data.activeUser;
            const dni = personal_information.dni;
            const firstName = personal_information.given_name;
            const lastName = personal_information.sn;

            let student = await Student.findOne({ identification: dni });

            if (student) {
                student.email = uid;
                await student.save();

                const studentRole = await RoleModel.findOne({ name: 'student' });
                if (!studentRole) {
                     res.status(500).json({ error: 'System error: Student role not defined' });
                     return;
                }

                let user = await UserModel.findOne({ identification: dni });
                if (!user) {
                    user = new UserModel({
                        email: uid, 
                        identification: dni,
                        firstName: firstName,
                        lastName: lastName,
                        roleId: studentRole._id,
                        studentId: student._id,
                        isActive: true
                    });
                } else {
                    user.roleId = studentRole._id;
                    user.studentId = student._id;
                    user.email = uid;
                    user.firstName = firstName;
                    user.lastName = lastName;
                }
                await user.save();

                const token = generateToken(user, 'student');
                res.json({
                    message: 'Login successful',
                    token,
                    user: {
                        _id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        role: 'student'
                    }
                });
                return;
            }
            
            let user = await UserModel.findOne({ identification: dni });

            if (!user) {
                user = new UserModel({
                    email: uid,
                    identification: dni,
                    firstName: firstName,
                    lastName: lastName,
                    roleId: undefined, 
                    isActive: true
                });
                await user.save();
                
                res.status(403).json({ 
                    message: 'User created but no role assigned.',
                    userCreated: true
                });
                return;
            }

            if (user.roleId) {
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
            } else {
                res.status(403).json({ 
                    message: 'User exists but has no role assigned.',
                    userCreated: true
                });
            }

        } catch (error: any) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    }
};
