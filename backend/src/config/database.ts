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

    const attendancesCollection = mongoose.connection.collection('attendances');
    const obsoleteIndexes = [
      'studentId_1_subjectId_1_date_1',
      'studentId_1_date_1',
      'subjectId_1_date_1'
    ];

    for (const indexName of obsoleteIndexes) {
      try {
        await attendancesCollection.dropIndex(indexName);
        console.log(`Dropped obsolete index: ${indexName}`);
      } catch (indexError: any) {
        const message = String(indexError?.message || '');
        if (
          indexError?.codeName !== 'IndexNotFound' &&
          !message.includes('index not found')
        ) {
          console.warn(`Could not drop index ${indexName}:`, indexError);
        }
      }
    }

    console.log("Database connection established successfully.");
    console.log("Connected to database:", mongoose.connection.name);
  } catch (error) {
    console.error("Database connection failure:", error);
    process.exit(1);
  }
}
