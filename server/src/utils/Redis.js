/*

    TOP LEVEL TODO:

    -- At one point, I was thinking I'd cache users' previous words in Redis
    -- If we go back to that, we'd need user specific caches, as opposed to these global caches
    -- Not sure that's worth the effort, though, when we can just use local storage
    -- In light of this, this module has shrunk


    ALSO: It's currently a messy file, with both this and the core having retries; That was to deal with debugging, can be optimized later probably
*/

const MAX_RETRIES = 2;
const CONNECT_RETRY_DELAY_MS = 10;
// Import Redis 
import { createClient } from 'redis'; 

// Declare redisClient for global use
let redisClient = null;

// Point to address of cache
// TODO: Do I need this?
const redisOptions = {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
};

// Get connected Redis client
// This is the literal function used in project 2
// TODO: Does it need to be modified at all?
export async function getRedisClient() {
    // If client exists and is ready, return it immediately.
    if (redisClient && redisClient.isReady) {
        return redisClient;
    }

    // If a connection attempt is already in progress, wait briefly and recheck.
    if (isConnecting) {
        console.log('Redis connection already in progress, waiting...');
        // Wait for a short duration and then try again
        await new Promise(resolve => setTimeout(resolve, CONNECT_RETRY_DELAY_MS / 2));
        // After waiting, if the client is  ready,return it.
        if (redisClient && redisClient.isReady) { 
            return redisClient;
        }

    }

    // Set flag to indicate a connection attempt is starting.
    isConnecting = true;

    // Loop for connection retries
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`Attempting to connect to Redis -- Attempt ${attempt})`);

        try {

            // Attempt delete of malformed Client
            if (redisClient) {
                try {
                    await redisClient.quit(); 
                } catch (quitErr) {

                }
            }
            redisClient = null; 
            redisClient = createClient(redisOptions);

            // NOTE: This formation implemented after watching redis repeatedly attempt to conenct to non-existant DB
            // If this make it into prod... that's why
            const errorHandler = (err) => {
                console.error(`Redis Client Error on connect (Attempt ${attempt}):`, err.message);
                redisClient = null;
            };
            redisClient.on('error', errorHandler);

            // Attempt to connect
            await redisClient.connect();
            console.log('Connected to Redis successfully');

            // If successful, reset the connecting flag and return the client.
            isConnecting = false;
            return redisClient;

        } catch (err) {
            // Log the connection error.
            console.error(`Failed to connect to Redis (Attempt ${attempt}):`, err.message);

            // Delete malformed client before trying again
            if (redisClient) {
                try {
                    await redisClient.quit();
                } catch (quitErr) {
                    console.warn("Error quitting failed Redis client during retry:", quitErr.message);
                }
                redisClient = null;
            }

            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, CONNECT_RETRY_DELAY_MS));
            }
        }
    }

    // After all attempts fail, reset the connecting flag and throw a final error.
    isConnecting = false;
    throw new Error(`Failed to establish a Redis connection`);
}


export async function checkRedisCache(word, wordLength, db) {
    const client = await getRedisClient(); 
    const key = `words:${wordLength}:${db}`;
    console.log("CHecking Redis: ", word, wordLength, db);
    if (await client.sismember(key, word.toLowerCase()) === 1) {
        return true;
    }
    return false;
}

export async function insertRedisCache(words, wordLength, db) {
    if (words.length === 0) {
        console.warn('addWordsToCache found no words');
        return 0;
    }
    const client = await getRedisClient(); 
    const key = `words:${wordLength}:${db}`;

    const lowerWords = words.map(word => word.toLowerCase());
    return await client.sadd(key, ...lowerWords);
}

export async function queryRedisCache(wordLength, db) {
    console.log("queryRedisCache");
    const client = await getRedisClient(); 
    const key = `words:${wordLength}:${db}`;
    return await client.smembers(key);
}