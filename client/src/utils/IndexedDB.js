let db;
const DB_NAME = 'GameHubDB';
const DB_VERSION = 1;
const STORE_NAME = 'activeGames'; 
const DICTIONARY_STORE_NAME = 'localWords'; 

export const openAppDB = () => {
    return new Promise((resolve, reject) => {
        // If the database is already open, resolve immediately
        if (db) {
            resolve(db);
            return;
        }

        // Request to open the IndexedDB database
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // This triggers when the db is being created, not just on an 'upgrade'
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            console.log('IndexedDB upgrade needed. Creating object stores...');

            // Create 'gameStore' if it doesn't exist, indexed by gameId
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const gameStore = db.createObjectStore(STORE_NAME, { keyPath: 'gameId' });
                // Create an index on userId to query sessions by user
                gameStore.createIndex('userId', 'userId', { unique: false });
                console.log(`Object store '${STORE_NAME}' created with keyPath 'gameId' and index 'userId'.`);
            }

            // Create 'dictionaryWords' if it doesn't exist.
            if (!db.objectStoreNames.contains(DICTIONARY_STORE_NAME)) {
                const dictionaryStore = db.createObjectStore(DICTIONARY_STORE_NAME, { keyPath: 'word' });
                console.log(`Object store '${DICTIONARY_STORE_NAME}' created with keyPath 'word'.`);

                // TODO: This sampleWords is for testing purposes
                // In actual app, we need a script to load in the words
                // Probably, we'll find some selection of words to put in the MongoDB, send that over, and have that be the offline words selection
                // TODO: Figure out how many words/how big that should be
                const sampleWords = ['apple', 'baker', 'crane', 'drain', 'early', 'fable', 'grape', 'house', 'igloo', 'jumbo'];
                sampleWords.forEach(word => {
                    dictionaryStore.add({ word: word, length: word.length });
                });
                console.log('Sample dictionary words added.');
            }
        };

        // Event handler for successful database opening
        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB opened successfully.');
            resolve(db);
        };

        // Event handler for database opening errors
        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.errorCode);
            reject(new Error('Failed to open IndexedDB.'));
        };
    });
};

export const saveGame = async (userId, gameData) => {
    try {
        await openAppDB(); // Ensure DB is open
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Add the userId to the gameData
        const IdentifiedData = { ...gameData, userId: userId };

        // Convert Sets and Maps to arrays for IndexedDB serialization
        if (IdentifiedData.yellows) {
            IdentifiedData.yellows = scopedData.yellows.map(set => Array.from(set));
        }
        if (IdentifiedData.yellowsCount) {
            IdentifiedData.yellowsCount = Array.from(scopedData.yellowsCount.entries());
        }
        if (IdentifiedData.grays) {
            IdentifiedData.grays = Array.from(scopedData.grays);
        }
        if (IdentifiedData.prevGuesses) {
            IdentifiedData.prevGuesses = Array.from(scopedData.prevGuesses);
        }

        const request = store.put(IdentifiedDataData); 
        await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
        console.log(`Game ${gameData.gameId} for user ${userId} saved.`);
    } catch (error) {
        console.error('Error saving game :', error);
        throw error;
    }
};

export const loadGame = async (userId, gameId) => {
    try {
        await openAppDB(); 
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(gameId);

        const data = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });

        // Verify that the loaded game belongs to the current  userId
        if (data && data.userId === userId) {
            console.log(`Game ${gameId} for user ${userId} loaded.`);
            // Convert arrays back to Sets and Maps for React state
            if (data.yellows) {
                data.yellows = data.yellows.map(arr => new Set(arr));
            }
            if (data.yellowsCount) {
                data.yellowsCount = new Map(data.yellowsCount);
            }
            if (data.grays) {
                data.grays = new Set(data.grays);
            }
            if (data.prevGuesses) {
                data.prevGuesses = new Set(data.prevGuesses);
            }
            return data;
        } else if (data) {
            console.warn(`Attempted to load game ${gameId}, but it did not match current userId.`);
        }
        return null;
    } catch (error) {
        console.error('Error loading game :', error);
        throw error;
    }
};

export const clearGame = async (userId, gameId) => {
    try {
        await openAppDB(); 
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // First, verify the game belongs to this user/app before deleting
        const existingData = await new Promise((resolve, reject) => {
            const request = store.get(gameId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });

        if (existingData && existingData.userId === userId) {
            const request = store.delete(gameId);
            await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            });
            console.log(`Game ${gameId} for user ${userId} cleared.`);
        } else {
            console.warn(`Attempted to clear game ${gameId}, but it did not match current userId, or was not found.`);
        }
    } catch (error) {
        console.error('Error clearing game :', error);
        throw error;
    }
};

export const getActiveGameId = async (userId) => {
    try {
        await openAppDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const userIdIndex = store.index('userId'); 

        let activeGameId = null;

        // Use the index to iterate over games for the current userId
        const request = userIdIndex.openCursor(IDBKeyRange.only(userId));

        await new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // Check if the game is active, resolve if not
                    if (!cursor.value.isOver ) {
                        activeGameId = cursor.value.gameId;
                        resolve(); 
                        return;
                    }
                    cursor.continue(); 
                } else {
                    resolve(); // No more active game found
                }
            };
            request.onerror = (event) => reject(event.target.error);
        });

        if (activeGameId) {
            console.log(`Found active game ID ${activeGameId} for user ${userId}.`);
        } else {
            console.log(`No active game found for user ${userId}.`);
        }
        return activeGameId;
    } catch (error) {
        console.error('Error getting active game ID:', error);
        throw error;
    }
};

export const checkWordInDB = async (word) => {
    try {
        await openAppDB(); 
        const transaction = db.transaction(DICTIONARY_STORE_NAME, 'readonly');
        const store = transaction.objectStore(DICTIONARY_STORE_NAME);
        const request = store.get(word.toLowerCase()); 

        const result = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
        // Same as with MongoDB, we need the '!!' formation to get a bool out of the lookup
        return !!result; 
    } catch (error) {
        console.error('Error checking word in IndexedDB dictionary:', error);
        // TODO: Should an error be handled differently than returning false? 
        return false;
    }
};

