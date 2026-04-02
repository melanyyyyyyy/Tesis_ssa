import 'dotenv/config';

const getEnv = (key: string, defaultValue?: string): string => {
    const value = process.env[key] || defaultValue;
    if (!value) {
        throw new Error(`Missing mandatory environment variable: ${key}`);
    }
    return value;
};

export const ENV = {
    PORT: parseInt(getEnv('PORT', '3000'), 10),
    FRONTEND_URL: getEnv('FRONTEND_URL', 'http://localhost:5173'),

    MONGO_URI: getEnv('MONGO_URI'),

    DB_USER: getEnv('DB_USER'),
    DB_NAME: getEnv('DB_NAME'),
    DB_HOST: getEnv('DB_HOST'),
    DB_PASSWORD: getEnv('DB_PASSWORD'),
    DB_PORT: parseInt(getEnv('DB_PORT', '5432'), 10),

    JWT_SECRET: getEnv('JWT_SECRET'),
    JWT_EXPIRES: getEnv('JWT_EXPIRES_IN', '1d'),

    EXTERNAL_AUTH_TOKEN: getEnv('EXTERNAL_AUTH_TOKEN'),
};