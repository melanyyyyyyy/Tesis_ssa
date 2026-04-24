import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ENV } from '../config/envs.js';
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

const adminUserData = {
  email: 'test_admin',
  identification: '10000000000',
  firstName: 'Administrador',
  lastName: 'De Prueba',
  isActive: true
};

type SeedOptions = {
  manageConnection?: boolean;
};

export async function seedRoles(options: SeedOptions = {}): Promise<void> {
  const { manageConnection = true } = options;

  try {
    if (manageConnection) {
      console.log('Connecting to MongoDB...');
      await mongoose.connect(MONGO_URI);
      console.log('Connected.');
    }

    for (const roleData of rolesToCreate) {
      const exists = await RoleModel.findOne({ name: roleData.name });
      if (!exists) {
        await RoleModel.create(roleData);
        console.log(`Role created: ${roleData.name}`);
      } else {
        console.log(`Role already exists: ${roleData.name}`);
      }
    }

    console.log('Roles seeding completed.');
  } catch (error) {
    console.error('Error seeding roles:', error);
    throw error;
  } finally {
    if (manageConnection) {
      await mongoose.disconnect();
      console.log('Disconnected.');
    }
  }
}

export async function createAdmin(options: SeedOptions = {}): Promise<void> {
  const { manageConnection = true } = options;

  try {
    if (manageConnection) {
      console.log('Connecting to MongoDB...');
      await mongoose.connect(MONGO_URI);
      console.log('Connected.');
    }

    const adminRole = await RoleModel.findOne({ name: 'admin' });
    if (!adminRole) {
      console.error("Error: Role 'admin' not found. Please run seedRoles.ts first.");
      return;
    }

    const adminExists = await UserModel.exists({ roleId: adminRole._id });
    if (adminExists) {
      console.log('Admin user already exists.');
      return;
    }

    console.log('Creating new admin user...');
    const user = await UserModel.create({
      ...adminUserData,
      roleId: adminRole._id
    });

    console.log(`User created: ${user.email} with role ${adminRole.name}`);
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  } finally {
    if (manageConnection) {
      await mongoose.disconnect();
      console.log('Disconnected.');
    }
  }
}

export async function ensureRolesAndAdmin(options: SeedOptions = {}): Promise<void> {
  const requiredRoleNames = rolesToCreate.map((role) => role.name);
  const existingRoles = await RoleModel.find(
    { name: { $in: requiredRoleNames } },
    { name: 1 }
  ).lean();

  const existingRoleNames = new Set(existingRoles.map((role) => role.name));
  const hasAllRoles = requiredRoleNames.every((roleName) => existingRoleNames.has(roleName));
  const adminRole = await RoleModel.findOne({ name: 'admin' });
  const adminExists = adminRole
    ? await UserModel.exists({ roleId: adminRole._id })
    : null;

  if (hasAllRoles && adminExists) {
    console.log('Roles and admin user already initialized.');
    return;
  }

  console.log('Missing roles or admin user. Running seedRoles.ts...');
  await seedRoles({ manageConnection: options.manageConnection });
  await createAdmin({ manageConnection: false });
}

async function runSeedScript(): Promise<void> {
  await seedRoles();
  await createAdmin();
}

const executedFile = process.argv[1] ?? '';
if (executedFile.endsWith('seedRoles.ts') || executedFile.endsWith('seedRoles.js')) {
  await runSeedScript();
}
