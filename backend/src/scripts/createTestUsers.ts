import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { UserModel, RoleModel } from '../models/system/index.js';
import { SubjectModel } from '../models/sigenu/index.js';
import { ENV } from '../config/envs.js'

/*
npx tsx src/scripts/createTestUsers.ts
*/

dotenv.config();

const MONGO_URI = ENV.MONGO_URI;

async function createSecretary() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const secretaryRole = await RoleModel.findOne({ name: 'secretary' });
        if (!secretaryRole) {
            console.error("Error: Role 'secretary' not found. Please run seedRoles.ts first.");
            return;
        }

        const userData = {
            email: 'test_secretary',
            identification: '10000000000',
            firstName: 'Secretario',
            lastName: 'De Prueba',
            roleId: secretaryRole._id,
            isActive: true
        };

        let user = await UserModel.findOne({ identification: userData.identification });

        if (user) {
            console.log('User already exists.');
            return;
        } else {
            console.log('Creating new user...');
            user = await UserModel.create(userData);
            console.log(`User created: ${user.email} with role ${secretaryRole.name}`);
        }

    } catch (error) {
        console.error('Error creating secretary user:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

async function createProfessor() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const professorRole = await RoleModel.findOne({ name: 'professor' });
        if (!professorRole) {
            console.error("Error: Role 'professor' not found. Please run seedRoles.ts first.");
            return;
        }

        const userData = {
            email: 'test_professor',
            identification: '10000000001',
            firstName: 'Profesor',
            lastName: 'De Prueba',
            roleId: professorRole._id,
            isActive: true
        };

        let user = await UserModel.findOne({ identification: userData.identification });

        if (user) {
            console.log('User already exists.');
            return;
        } else {
            console.log('Creating new user...');
            user = await UserModel.create(userData);
            console.log(`User created: ${user.email} with role ${professorRole.name}`);
        }

    } catch (error) {
        console.error('Error creating professor user:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

await createSecretary();
await createProfessor();

/*
db.subjects.updateOne(
  { sigenId: "-591e423f:16585e8c5ee:-2fa2" },
  { 
    $set: { 
      professorId: db.users.findOne({ firstName: "Profesor", lastName: "De Prueba" })._id 
    } 
  }
)
*/

