import mongoose from 'mongoose';
const { Schema } = mongoose; 

/*

  OVERARCHING DESIGN NOTES: 

  * All words are to be stored in lower case



*/ 

// We don't need to store length, as we know the length by the collection
// If we ever have mismatching lengths for the words, letters, etc, then there's a logic error in the code calling mongoose, not here
// TODO: Consider abstracting out the schema to modules?

export const wordSchema = new Schema({
  word: { type: String }, // The actual word
  indices: [String], // An index of its letters
});

export const createWordCollection = async (db, length) => {
  const collectionName = `${db}_${length}`;

  // Check if collection already exists
  const exists = await mongoose.connection.db
    .listCollections({ name: collectionName })
    .hasNext();
  if (exists) {
    console.log(`Collection "${collectionName}" already exists.`);
    return;
  }

  // Create the collection in the database
  await mongoose.connection.createCollection(collectionName);
  console.log(`Created collection "${collectionName}".`);

};


// Get collection of words for category (db, length)
export const getWordModel = (db, length) => {
  const collectionName = `${db}_${length}`;
  return mongoose.models[collectionName] || mongoose.model(collectionName, wordSchema, collectionName);
};

export const createWordModel = (db, length) => {
  const collectionName = `${db}_${length}`;
  return mongoose.model(collectionName, wordSchema, collectionName);
};

// Add a word to the collection (if it doesn’t exist yet)
export const addWordToCollection = async (word, length, db) => {
  const WordModel = getWordModel(db, length);

  // Prevent duplicate inserts by checking first
  const exists = await WordModel.exists({ word });
  if (exists) return false;

  const indices = word.split('');
  const newWord = new WordModel({ word, indices });

  await newWord.save();
  return true;
};

export const checkWordInCollection = async (word, length, db) => {
  const WordModel = getWordModel(db, length);
  return await WordModel.exists({ word: word.toLowerCase() });
};

// TODO: Actually use the firebase credentials to store user games with their IDS
