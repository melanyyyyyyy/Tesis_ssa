import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { RoleModel } from '../models/system/index.js';
import { ENV } from '../config/envs.js'

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

seedRoles();
