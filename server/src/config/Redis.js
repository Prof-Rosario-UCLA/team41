import createClient from 'redis';

let redisClient;

// Point to address of cache
// TODO: Do I need this??
const redisOptions = {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
};

export const connectRedis = async () => {
    try {
        redisClient = createClient(redisOptions);
        await redisClient.connect();
        console.log('Redis Connected');
        redisClient.on('error', err => console.error('Redis Client Error', err));
    } catch (error) {
        console.error(`Error connecting to Redis: ${error.message}`);
        // TODO: DO we need to exit on failure here? 
    }
};
