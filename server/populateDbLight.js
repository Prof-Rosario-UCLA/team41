import fs from 'fs/promises'; 
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { addWordToCollection, createWordCollection } from './src/utils/MongoDB.js'; 
import { connectDB } from './src/config/MongoDB.js';

dotenv.config(); 

const DB_NAME = 1; 
const TXT_FILE_PATH = 'wordleWordsLight.txt';

async function populateDatabase(wordLength) {
  try {
    await connectDB();
    console.log(`\n[${wordLength}] Database connection established.`);

    await createWordCollection(DB_NAME, wordLength);

    const filePath = path.join(process.cwd(), TXT_FILE_PATH); 
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const words = fileContent.split('\n')
      .map(word => word.trim().toLowerCase()) 
      .filter(word => word.length === wordLength); 

    console.log(`[${wordLength}] Found ${words.length} words.`);

    let insertedCount = 0;
    let duplicateCount = 0;

    for (const word of words) {
      if (word) { 
        const added = await addWordToCollection(word, wordLength, DB_NAME);
        if (added) {
          insertedCount++;
        } else {
          duplicateCount++;
        }
      }
    }

    console.log(`[${wordLength}] Inserted: ${insertedCount}, Duplicates: ${duplicateCount}`);
  } catch (error) {
    console.error(`[${wordLength}] Error:`, error);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log(`[${wordLength}] Disconnected from MongoDB.`);
    }
  }
}

async function runAll() {
  for (let wordLength = 3; wordLength <= 10; wordLength++) {
    await populateDatabase(wordLength);
  }
  process.exit(0);
}

runAll();
