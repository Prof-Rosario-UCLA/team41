import fs from 'fs/promises'; 
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';
import { addWordToCollection, createWordCollection } from './src/utils/MongoDB.js'; 
import { connectDB } from './src/config/MongoDB.js';

dotenv.config(); 

// TODO: Make these not static; they're static for testing rn
// Ideally, we should be able to run this from the command line, or do a range 3-10 or something
const DB_NAME = 1; 
const WORD_LENGTH = 5;
const TXT_FILE_PATH = 'wordleWords.txt';

async function populateDatabase() {
  let dbConnection = null; 

  try {
    // Connect to MongoDB
    await connectDB();
    console.log('Database connection established for population.');

    // Ensure collection exists
    await createWordCollection(DB_NAME, WORD_LENGTH);

    // Read words from the text file
    const filePath = path.join(process.cwd(), TXT_FILE_PATH); 
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const words = fileContent.split('\n')
      .map(word => word.trim().toLowerCase()) 
      .filter(word => word.length === WORD_LENGTH); 

    console.log(`Found ${words.length} words of length ${WORD_LENGTH} to insert.`);

    // Insert words into the database
    let insertedCount = 0;
    let duplicateCount = 0;

    for (const word of words) {
      console.log(word);
      if (word) { 
        const added = await addWordToCollection(word, WORD_LENGTH, DB_NAME);
        if (added) {
          insertedCount++;
        } else {
          duplicateCount++;
        }
      }
    }

    console.log(`\nPopulation Complete:`);
    console.log(`Successfully inserted: ${insertedCount} words.`);
    console.log(`Skipped (duplicates): ${duplicateCount} words.`);

  } catch (error) {
    console.error('Error during database population:', error);
  } finally {
    // Close MongoDB connection
    if (mongoose.connection.readyState === 1) { 
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB.');
    }
    process.exit(0); 
  }
}

populateDatabase();