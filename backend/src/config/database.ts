import mongoose from "mongoose";
import { ENV } from "./envs.js";

export async function connectDatabase(): Promise<void> {
  const mongoUri = ENV.MONGO_URI;

  if (!mongoUri) {
    console.error("Configuration Error: MONGO_URI is not defined in the environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);

    console.log("Database connection established successfully.");
    console.log("Connected to database:", mongoose.connection.name);
  } catch (error) {
    console.error("Database connection failure:", error);
    process.exit(1);
  }
}
