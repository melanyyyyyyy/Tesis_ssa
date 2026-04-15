import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ENV } from '../config/envs.js'
import { UserModel, RoleModel } from '../models/system/index.js';

/*
npx tsx src/scripts/seedRoles.ts
*/

dotenv.config();

const MONGO_URI = ENV.MONGO_URI;

const rolesToCreate = [
    { name: 'student' },
    { name: 'professor' },
    { name: 'secretary' },
    { name: 'vicedean' },
    { name: 'admin' }
];

async function seedRoles() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        for (const roleData of rolesToCreate) {
            const exists = await RoleModel.findOne({ name: roleData.name });
            if (!exists) {
                await RoleModel.create(roleData);
                console.log(`Role created: ${roleData.name}`);
            } else {
                console.log(`Role already exists: ${roleData.name}`);
            }
        }
        console.log('Seeding completed.');
    } catch (error) {
        console.error('Error seeding roles:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

async function createAdmin() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const adminRole = await RoleModel.findOne({ name: 'admin' });
        if (!adminRole) {
            console.error("Error: Role 'admin' not found. Please run seedRoles.ts first.");
            return;
        }

        const userData = {
            email: 'test_admin',
            identification: '10000000000',
            firstName: 'Administrador',
            lastName: 'De Prueba',
            roleId: adminRole._id,
            isActive: true
        };

        let user = await UserModel.findOne({ identification: userData.identification });

        if (user) {
            console.log('User already exists.');
            return;
        } else {
            console.log('Creating new user...');
            user = await UserModel.create(userData);
            console.log(`User created: ${user.email} with role ${adminRole.name}`);
        }

    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

await seedRoles();
await createAdmin();
