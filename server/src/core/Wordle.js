/*
    TOP LEVEL TODO:
    1. Support for different languages
        -- Right now, we assume the user isn't able to input characters besides letters (which is true with the html form)
        -- But, if that changes, we'd need more checks
*/

const MAX_RETRIES = 2;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;


import { queryRedisCache, checkRedisCache }  from '../utils/Redis.js';
import { getWordModel, checkWordInCollection } from '../utils/MongoDB.js';
import { QueryStatus, ContainedStatus } from '../Enums.js';

// Check if a word is contained in our word banks
// First check the local indexed db, then the redis cache, and finally the MongoDB
export async function isContained(word, wordLength, db) {
    console.log("s");
    let exists = false;
    let status = ContainedStatus.VALID;

    // Redis, then MongoDB
    ({ exists, status } = await isContainedRedis(word, wordLength, db));

    if (exists || status === ContainedStatus.VALID) {
        return { exists: exists, status: status };
    }
    console.log("after");
    ({ exists, status } = await isContainedMongoDB(word, wordLength, db));

    if (exists || status === ContainedStatus.VALID) {
        console.log("Exists, status", exists, status);
        return { exists: exists, status: status };
    }

    // if neither of these work, return false with status from MOngoDB
    return { exists: false, status: status };
}


async function isContainedMongoDB(word, wordLength, db) {
    let exists;
    let status;
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        try {
            const found = await checkWordInCollection(word, wordLength, db);
            // This !! deals with the fact that Mongoose's .exists returns null if it doesn't exist as opposed to a boolean for some reason
            exists = !!found;
            status = ContainedStatus.VALID;
            return { exists, status };
        } catch (error) {
            attempt++;
            console.warn(`Attempt ${attempt} to check word in MongoDB failed: ${error.message}`);

            // Increasing delay for retry (TODO: Make this exponential)
            await new Promise(res => setTimeout(res, 1000 * attempt));
        }
    }

    return { exists: false, status: ContainedStatus.MONGODB_QUERY_FAILED };
}

async function isContainedRedis(word, wordLength, db) {

    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        try {
            const found = await checkRedisCache(word, wordLength, db);
            return { exists: found, status: ContainedStatus.VALID };
        } catch (error) {
            attempt++;
            console.warn(`Attempt ${attempt} to check word in Redis failed: ${error.message}`);

            // Increasing delay for retry (TODO: Make this exponential)
            await new Promise(res => setTimeout(res, 100 * attempt));
        }
    }
    
    return { exists: false, status: ContainedStatus.REDIS_QUERY_FAILED };
}

// Choose the word for the game
// If theme is selected, OpenAI API used to query LLM to generate word with that theme
// Else, MongoDB/Redis
export async function chooseWord(wordLength, letterRestrict, letterGuarantee, specificRestrict, db, theme, prevWords, repeats) {

    if (theme) {
        console.log("chooseWordThematic");
        return chooseWordThematic(wordLength, theme, db, prevWords, repeats);
    } else {
        console.log("chooseWordRemote");
        return chooseWordRemote(wordLength, letterRestrict, letterGuarantee, specificRestrict, db, prevWords, repeats);
    }
}

// Given parameters, select word from remote wordbanks
// Call this if no workable word found locally


// Length: Int
// letterRestrict/letterGuarantee: string with letter restrictions/guarantees for the word
// -- '_' = no restriction
// -- 'asdf' (lowercase) = restricted letters, cannot appear in the word
// -- 'ASDF' (UPPERCASE) = guaranteed letters, must appear in the word
// specificRestrict: Same thing, but this time the order matters
// db: an ENUM. The db to query from; i.e., regular words, extended words, etc; potentially, this could be used for different languages



async function chooseWordRemote(wordLength, letterRestrict, letterGuarantee, specificRestrict, db, prevWords, repeats) {
    


    let wordbank = [];
    let status;
    
    // No check for query being possible; we assume it is if the call was made
    // If it's a complex query, don't try Local or Redis
    if (specificRestrict || letterRestrict || letterGuarantee) {
        console.log("Attempt queryMongoDB");
        ({ wordbank, status } = await queryMongoDB(wordLength, letterRestrict, letterGuarantee, specificRestrict, db));

        if (status !== QueryStatus.VALID) {
            return {
                target: "",
                status: status,
            };
        }

    } else {

        // First, try Redis
        if (wordbank.length === 0) {
            console.log("Attempt queryRedis");
            ({ wordbank, status } = await queryRedis(wordLength, db));
          
            // If we got a valid result, return it
            if (status === QueryStatus.VALID && wordbank && wordbank.length > 0) {
                
                const randWord = randomWord(wordbank, prevWords, repeats);
                if (randWord) {
                    return {
                        target: randWord,
                        status: status,
                    };
                }

            }
        }

        // Finally, query MongoDB
        ({ wordbank, status } = await queryMongoDB(wordLength, letterRestrict, letterGuarantee, specificRestrict, db, repeats));
        if (status !== QueryStatus.VALID) {
            console.log("MongoDB Query didn't work: ", status);
            return {
                target: "",
                status: status,
            };
        }
    
    }

    // If no valid words were found anywhere, then we can't pick a word
    if (wordbank.wordLength === 0) {
        console.log("No words were found!");
        return {
            target: "",
            status: QueryStatus.NO_WORDS_FOUND,
        };
    }

    console.log("found wordbank:", wordbank);

    // If word found, populate the Cache with words that would be relevant this game
    // TODO: This
    // await populateRedisCache(wordLength, db);

    // Choose a word from the wordbank
    // If repeats aren't allowed, this will exclude the previous words
    return randomWord(wordbank, prevWords, repeats);
}

// Generate word from a theme (OpenAI)
// Experimentally, it works well enough with wordLength.
// TODO: Customizability for how loosely the words can be connected (we'll change the prompt + temperature)
// TODO: Check Redis cache for theme before querying OpenAI
async function chooseWordThematic(theme, wordLength, db, prevWords, repeats) {
    // Query OpenAI for words of this wordLength/theme
    // TODO: Prompt engineering: This (and the system prompt) can probably be tuned more for better results
    // We're getting decent results with this, but, it could probably be better
    const prompt = `Give a list of real ${wordLength}-letter lowercase words that best fit the theme: "${theme}".
    If the theme is offensive, respond with only: OFFENSIVE.
    If the theme is random nonsense (e.g. just unrelated words), respond with only: UNREASONABLE.
    Otherwise, return at least one matching word. Use exactly one space between words.
    Only return valid words that are exactly ${wordLength} letters long.
    Return as many words as fit these parameters`;

    try {
        const llmWords = await queryOpenAI(prompt);
        const wordbank = [];

        for (const word of llmWords) {
            if (isContained(word, wordLength, db)) {
                wordbank.push(word);
            }
        }

        if (wordbank.length === 0) {
            return {
                target: "",
                status: QueryStatus.NO_WORDS_FOUND_THEMATIC,
            };
        }

        // Store found words in Redis
        thematicCache(wordbank, wordLength, theme);

        // Return wordbank
        return randomWord(wordbank, prevWords, repeats);
    } catch (error) {
        // Final failure after retries
        console.error("Failed to get words from OpenAI after retries:", error);
        return {
            target: "",
            status: QueryStatus.LLM_REQUEST_FAILED,
            errorMessage: error.message,
        };
    }
}

// QUERY LOGIC

// Match every case to query from the MongoDB

async function queryMongoDB(wordLength, letterRestrict, letterGuarantee, specificRestrict, db) {
    let attempt = 0;

    console.log("queryMongoDB params: ", 
        wordLength, letterRestrict, letterGuarantee, specificRestrict, db
    )

    // This should, on the MAX_RETRIESth error, enter the catch and successfully throw
    while (attempt < MAX_RETRIES) {
        try {
            // Get mongoose model for the database and length.
            const WordModel = getWordModel(db, wordLength);

            if (!WordModel) {
                console.error(`Error: WordModel for db: '${db}', length: ${wordLength} not found`);
                return { status: QueryStatus.MONGODB_QUERY_FAILED };
            }

            // Build mongoose query; this is done by sequentially adding parameters to the query
            const query = {};

            // Filter out words containing restricted letters.
            if (letterRestrict && letterRestrict.length > 0) {
                const restrictedLetters = Array.from(letterRestrict).map(c => c.toLowerCase()).join('');
                console.log(restrictedLetters);
                // REGEX matching: this pattern matches any string with a restrictedLetter, so take not of that
                query.word = { $not: { $regex: `[${restrictedLetters}]` } };
            }

            // Filter out words that don't contain all guaranteed letters
            if (letterGuarantee && letterGuarantee.length > 0) {
                const guaranteedLetters = Array.from(letterGuarantee.toLowerCase());
                console.log('Guaranteed letters:', guaranteedLetters);
                query.indices = { ...(query.indices || {}), $all: guaranteedLetters };
            }

            // Filter out words that don't match specificRestrict
            if (specificRestrict) {
                for (let i = 0; i < specificRestrict.length; i++) {
                    const char = specificRestrict[i];
                    if (char === '_') {
                        continue;
                    } else if (char === char.toUpperCase()) {
                        query[`indices.${i}`] = char.toLowerCase();
                    } else if (char === char.toLowerCase()) {
                        query[`indices.${i}`] = { $ne: char };
                    }
                }
            }

            // Execute the query
            let words = await WordModel.find(query).lean();

            // Return an array containing only the 'word' strings from the results.
            return { wordbank: words.map(doc => doc.word), status: QueryStatus.VALID };
        } catch (error) {
            attempt++;
            console.warn(`Attempt ${attempt} failed: ${error.message}`);
            if (attempt >= MAX_RETRIES) {
                return { status: QueryStatus.MONGODB_QUERY_FAILED };
            }
            // Increasing delay
            // TODO: Make this exponential
            await new Promise(res => setTimeout(res, 50 * attempt));
        }
    }
}

async function queryRedis(wordLength, db) {
    let words = [];
    let status;
    let attempt = 0;
      console.log("Attempt: ", attempt)
    while (attempt < MAX_RETRIES) {
        try {
            console.log("Attempt: ", attempt)
            words = await queryRedisCache(wordLength, db);
            status = QueryStatus.VALID;
            console.log("Redis return valid")
            return { words, status };
        } catch (error) {
            attempt++;
            console.warn(`Attempt ${attempt} to query Redis failed: ${error.message}`);

            // Increasing delay for retry (TODO: Make this exponential)
            await new Promise(res => setTimeout(res, 1000 * attempt));
        }
    }

    return { words: [], status: QueryStatus.REDIS_QUERY_FAILED };
}


// TODO: Actually implement getting the API Key
// TODO: The error messages, and the format of the response
// TODO: Redis interaction
async function queryOpenAI(prompt) {
    const API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
    let attempt = 0;

    // This should, on the MAX_RETRIESth error, enter the catch and successfully throw
    while (attempt < MAX_RETRIES) {
        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",

                    messages: [
                        {
                            // TODO: Can 'content' here be optimized?
                            role: "system",
                            content: "You are a helpful assistant. Provide only the requested word(s) and no other introductory or concluding text."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],

                    max_tokens: 10,
                    temperature: 0.75
                })
            });

            // TODO: Different error messages
            // Check if the API call was successful
            // Not using many throw/catch modules, but it's necessary here for retries
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API error: ${response.status} -- ${errorData.message || response.statusText}`);
            }

            const data = await response.json();

            // Process the response; this should yield the list we want
            const generatedText = data.choices[0]?.message?.content?.trim();

            if (!generatedText) {
                throw new Error("OpenAI did not return text in the expected format.");
            }

            return generatedText.split(" ");
        } catch (error) {
            attempt++;
            console.warn(`Attempt ${attempt} failed: ${error.message}`);
            if (attempt >= MAX_RETRIES) {
                throw error;
            }
            // Increasing delay
            // TODO: Make this exponential
            await new Promise(res => setTimeout(res, 50 * attempt));
        }
    }
}

// Move words of wordLength to Redis cache
// TODO: Should this be by user? It may be fine to allow different users to take it
async function thematicCache(wordLength, theme) {
    // TODO: Store individual words as documents indexed by'theme'
}

// Get random word from array
function randomWord(wordbank, prevWords, repeats) {
    let word;

    while (wordbank.length > 0) {
        const index = Math.floor(Math.random() * wordbank.length);
        word = wordbank[index];
        wordbank.splice(index, 1);

        if (!repeats || !prevWords.has(word)) {
            return { target: word, status: QueryStatus.VALID };
        }
    }

    return { status: QueryStatus.NO_WORDS_FOUND };
}