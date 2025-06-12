
// IMPORTS:
const { queryRedisCache, checkRedisCache } = require('./Redis');
const { getWordModel, checkWordInCollection } = require('./Mongoose');
const { WordBank, GameMode, GuessStatus, QueryStatus, ContainedStatus } = require('./Utils');

// GLOBAL VARIABLES:

// TODO: Make this actually dynamic with the app being on/off -- Weds
const ONLINE = true;
const MAX_RETRIES = 2;

// TODO: CANNOT DO THIS IN FINAL IMPLEMENTATION
// TODO: Retrieve API key from backend
require('dotenv').config();
const apiKey = process.env.OPENAI_API_KEY;

// GAME LOGIC -- FRONT END:
// TODO: Extract this out to its own file

// Logic that actually plays the game
// This includes the REACT components and all
function playGame() {
    // Initialize parameter variables
    let wordLength;
    let numGuesses;
    let letterRestrict;
    let letterGuarantee;
    let specificRestrict;
    let db;
    let theme;
    let mode;
    let repeats;

    // Selection screen variables
    let isChosen = false;
    let queryErrMsg = null;
    let status;

    // Target
    let target;

    while (!isChosen) {
        ({ wordLength, guesses, letterRestrict, letterGuarantee, specificRestrict, db, theme, mode, repeats } = getParameters());
        ({ target, status } = chooseWord(wordLength, letterRestrict, letterGuarantee, specificRestrict, db, theme, repeats));

        if (status === QueryStatus.VALID) {
            isChosen = true;
        } else {
            // TODO: Better descriptions
            switch (status) {
                case QueryStatus.ERR_LENGTH:
                    queryErrMsg = `Specific Requirements cannot be longer than the word length`;
                    break;
                case QueryStatus.ERR_LETTER_GUARANTEE_TOO_LARGE:
                    queryErrMsg = `Can't guarantee more letters than the word length`;
                    break;
                case QueryStatus.ERR_LETTER_RESTRICT_SPECIFIC:
                    queryErrMsg = `The Specific Requirements contain restricted letters`;
                    break;
                case QueryStatus.ERR_LETTER_RESTRICT_GUARANTEE:
                    queryErrMsg = `Letters Guarantee contains restricted letters`;
                    break;
                case QueryStatus.ERR_LETTER_GUARANTEE_SPECIFIC:
                    queryErrMsg = `Letters Guarantee inconsistent with Specific Requirements`;
                    break;
                case QueryStatus.NO_WORDS_FOUND:
                    queryErrMsg = `No words found meeting the requirements`;
                    break;
            }
        }
    }

    // Initialize game board
    const board = Array.from({ wordLength: numGuesses }, () =>
        Array.from({ wordLength }, () => "")
    );

    // Initialize greens, yellows, and grays
    let greens = new Array(wordLength).fill('_');

    // NOTE: 'yellows', here, isn't actually strictly the yellows.
    // It also contains grays that appear because there's more of a letter than there are yellows of it
    let yellows = [];

    for (let i = 0; i < wordLength; i++) {
        yellows[i] = new Set();
    }

    let yellowsCount = new Map();
    let grays = new Set();

    // Game info
    let prevGuesses = new Set();

    let hasWon = false;
    let isOver = false;
    let currentGuess = 0;
    let displayErrMsg = false;

    // While the player has guesses, accept a guess and compare it to the target
    while (currentGuess < numGuesses) {
        // Input new guessses until we get a valid one
        let guess;
        let isValidGuess = false;
        while (!isValidGuess) {
            let errMsg = null;
            const { guess, status, index, letter, size } = inputGuess(guess, wordLength, letterRestrict, letterGuarantee, specificRestrict, db, mode, greens, yellows, yellowsCount, grays, prevGuesses, repeats);

            if (status === GuessStatus.VALID) {
                isValidGuess = true;
                console.log(`Guess ${guess} was found to be valid`)
            } else {
                // TODO: Casing inconsistencies?
                switch (status) {
                    case GuessStatus.ERR_LENGTH:
                        errMsg = `Guess must be ${wordLength} letters long`;
                        break;
                    case GuessStatus.ERR_PREV:
                        errMsg = `${guess} was guessed already!`;
                        break;
                    case GuessStatus.ERR_LETTER_RESTRICT:
                        errMsg = `${guess} contains restricted letter ${letter}`;
                        break;
                    case GuessStatus.ERR_LETTER_GAURANTEE:
                        errMsg = `${guess} does not contain required letter ${letter}`;
                        break;
                    case GuessStatus.ERR_SPECIFIC_RESTRICT_1:
                        errMsg = `${guess} contradicts requirement: letter #${index} == ${specificRestrict[index]}`;
                        break;
                    case GuessStatus.ERR_SPECIFIC_RESTRICT_2:
                        errMsg = `${guess} contradicts requirement: letter #${index} =/= ${specificRestrict[index]}`;
                        break;
                    case GuessStatus.ERR_GRAYS:
                        errMsg = `The target does not include '${index}'`;
                        break;
                    case GuessStatus.ERR_GREENS:
                        errMsg = `${guess} does not include confirmed letter '${guess[index]}' at position ${index}`;
                        break;
                    case GuessStatus.ERR_YELLOWS_CONTRADICT:
                        errMsg = `The letter '${guess[index]}' does not appear at position ${index}`;
                        break;
                    case GuessStatus.ERR_YELLOWS_MISSING:
                        errMsg = `The target includes at least '${size}' of the letter ${letter}`;
                        break;
                    case GuessStatus.WORD_NOT_FOUND:
                        errMsg = `Guess was not a valid word`;
                        break;
                    // Note: We should never get a Redis error here, because we'd simply try MongoDB next
                    case GuessStatus.MONGODB_QUERY_FAILED:
                    case ContainedStatus.ERR_NO_MONGOOSE_MODEL:
                        errMsg = `Error querying remote databases. Please try again later`;
                        break;
                }

                console.log(errMsg);
            }
        }

        // Add to previous guesses
        prevGuesses.add(guess);

        // Compute guess result against the target, updating the
        let result = checkGuess(guess, target, greens, yellows, yellowsCount, grays);

        // Update game state with result
        hasWon = true;
        for (let i = 0; i < wordLength; i++) {
            // TODO: This should be an animaton
            board[currentGuess][i] = result[i];
            if (result[i] != LetterResult.GREEN) {
                hasWon = false;
            }
        }

        // Check if game was won
        if (hasWon) {
            break;
        }

        currentGuess++;
    }

    isOver = true;

    // TODO: if (gameWon)... else...

    // Send Game to history
}

// Get parameters from html form
/*
    Types:
        wordLength: int
        numGuesses: int
        letterRestrict: Set
        letterGuarantee: Array
        specficRestrict: string
        db: int
        theme: string
        repeats: bool

    TODO: Refactor to new data structures so we don't have to convert them when building mongoose queries
*/
async function getParameters() {
    // TOOD: Parse HTML form for variables

    if (invalidPartameters(wordLength, numGuesses, letterRestrict, letterGuarantee, specificRestrict)) {
        throw new Error("Error: getParameter found invalid parameters")
    }

    // Return results of HTML form
    return {
        wordLength: 0,
        numGuesses: 0,
        letterRestrict: new Set(),
        letterGuarantee: new Set(),
        specificRestrict: "",
        db: 1,
        theme: "",
        repeats: false,
    }
}

async function inputGuess(guess, wordLength, letterRestrict, letterGuarantee, specificRestrict, db, mode, greens, yellows, yellowsCount, grays, previous) {
    // TODO: Get 'guess' from the user
    return isValid(guess, wordLength, letterRestrict, letterGuarantee, specificRestrict, db, mode, greens, yellows, yellowsCount, grays, previous);
}


// GUESS LOGIC

// Check whether the user's guess was a valid guess
// FEAT: Check against specific word pools for 'theme' mode
// TODO: Check this function experimentally. I believe it's correct, but need to verify emprically
async function isValid(guess, wordLength, letterRestrict, letterGuarantee, specificRestrict, db, mode, greens, yellows, yellowsCount, grays, prevGuesses) {
    console.log(`validGuess found guess '${guess}', wordLength '${wordLength}', letterRestrict '${letterRestrict}', letterGuarantee ${letterGuarantee}', specificRestrict '${specificRestrict}', db '${db}', mode '${mode}'`);

    // Check wordLength
    if (typeof guess !== 'string' || guess.length != wordLength) {
        return {
            guess: guess,
            status: GuessStatus.ERR_LENGTH,
        };
    }

    // Normalize guess (shouldn't be necessary but feels like good practice)
    let guess = guess.toLowerCase();

    // Check that it's not a previous guess
    if (prevGuesses.has(guess)) {
        return {
            guess: guess,
            status: GuessStatus.ERR_PREV,
        };
    }

    // If the game mode is hard, don't allow guesses contradicting established information
    // TODO: Add more granularity here
    // -- regular 'hard' mode: can't make guesses contradicting established information
    // -- extra 'hard' mode: can't make guesses contradicting the parameters either
    // -- extra 'regular' mode: can make guesses contradicitng established info but not the parameters
    if (mode === 2 || mode === 4) {
        let yellowsCountCopy = new Map(yellowsCount);

        let letters = new Set();
        for (let i = 0; i < wordLength; i++) {
            letters.add(guess[i]);

            // Don't allow guesses of restricted letters
            if (letterRestrict.has(guess[i])) {
                return {
                    guess: guess,
                    status: GuessStatus.ERR_LETTER_RESTRICT,
                    word: guess[i],
                };
            }

            // Don't allow guesses contradicting specificRestrictions
            if (specificRestrict[i] !== '_') {
                const targetChar = specificRestrict[i];

                if (targetChar === targetChar.toUpperCase()) {
                    if (guess[i] !== targetChar.toLowerCase()) {
                        return {
                            guess: guess,
                            status: GuessStatus.ERR_SPECIFIC_RESTRICT_1,
                            index: i,
                        };
                    }
                } else {
                    // Must differ from this letter
                    if (guess[i] === targetChar) {
                        return {
                            guess: guess,
                            status: GuessStatus.ERR_SPECIFIC_RESTRICT_2,
                            index: i,
                        };
                    }
                }
            }

            // Don't allow gray letters
            if (grays.has(guess[i])) {
                return {
                    guess: guess,
                    status: GuessStatus.ERR_GRAYS,
                    letter: guess[i],
                };
            }

            // Require guess to be consistent with greens
            if (greens[i] !== '_' && guess[i] !== greens[i]) {
                return {
                    guess: guess,
                    status: GuessStatus.ERR_GREENS,
                    index: i,
                };
            }

            // Don't allow a repeated yellow
            // NOTE: this letter might not have actually been found to be a yellow, but a grey coming after a yellow
            if (guess[i] === yellows[i]) {
                return {
                    guess: guess,
                    status: GuessStatus.ERR_YELLOWS_CONTRADICT,
                    index: i,
                };
            }

            // Decrement count of this yellow
            // We do this to ensure we have the proper amount of letters for each yellow
            if (yellowsCountCopy.has(guess[i])) {
                yellowsCountCopy.set(guess[i], yellowsCountCopy.get(guess[i]) - 1);
            }
        }

        // Check for required letters
        for (const letter in letterGuarantee) {
            if (!letters.has(letter)) {
                return {
                    guess: guess,
                    status: GuessStatus.ERR_LETTER_GAURANTEE,
                    letter: letter
                };
            }
        }

        // Check that we have the correct amount of each yellow
        for (const letter of yellowsCountCopy.keys()) {
            if (yellowsCountCopy.get(letter) !== 0) {
                // Calculate minimum necessary yellow letters
                let size = 0;
                for (let i = 0; i < wordLength; i++) {
                    if (guess[i] = letter) {
                        size++;
                    }
                }
                return {
                    guess: guess,
                    status: GuessStatus.ERR_YELLOWS_MISSING,
                    letter: letter,
                    size: size,
                };
            }
        }
    }

    // Check databases for guess
    // TODO: create functionality for matching against specific db's
    // -- only words falling under a particular 'theme' for theme
    // -- only words stored locally for offline functionality

    // If the mode is lenient, the guess doesn't need to be an actual word
    if (!(mode === 3 || mode === 4)) {
        let exists;
        let status;
        switch (ONLINE) {
            case false:
                ({ exists, status } = isContainedLocal(guess, wordLength, db));

                if (status !== ContainedStatus.VALID) {
                    return {
                        status: status
                    }
                }

                if (!exists) {
                    return {
                        status: GuessStatus.WORD_NOT_FOUND,
                    };
                }
                break;


            case true:
                ({ exists, status } = isContained(guess, wordLength, db));

                if (status !== ContainedStatus.VALID) {
                    return {
                        status: status
                    }
                }

                if (!exists) {
                    return {
                        status: GuessStatus.WORD_NOT_FOUND,
                    };
                }
                break;
        }
    }

    // If all these checks pass, the word is valid
    return {
        guess: guess,
        status: GuessStatus.VALID,
    };
}

// Check a guess against the target
// TODO: Check this function experimentally. I believe it's correct, but need to verify emprically
async function checkGuess(guess, target, greens, yellows, yellowsCount, grays) {
    let result = new Array(guess.length).fill(LetterResult.WHITE);
    let newYellowsCount = new Map();

    // Create a map of each of the letters
    // This will be used to compute yellows
    let targetLetters = new Map();
    for (const letter of target) {
        if (targetLetters.has(letter)) {
            targetLetters.set(letter, targetLetters.get(letter) + 1);
        } else {
            targetLetters.set(letter, 1);
        }
    }

    // Match the letters of guess to find greens and grays, and update the yellows map
    for (let i = 0; i < guess.length; i++) {
        if (targetLetters.has(guess[i])) {
            if (guess[i] === target[i]) {
                result[i] = LetterResult.GREEN;
                greens.add(guess[i]);
                targetLetters.set(guess[i], targetLetters.get(guess[i]) - 1);

                // Decrement yellowsCount, as we've found this letter to be a green, not a yellow
                if (yellowsCount.has(guess[i]) && yellowsCount.get(guess[i] > 0)) {
                    yellowsCount.set(yellowsCount.get(guess[i]), yellowsCount.get(guess[i]) - 1);
                }
            }
        } else {
            result[i] = LetterResult.GRAY;
            grays.add(guess[i]);
        }
    }

    // Compute the yellows values
    for (let i = 0; i < guess.length; i++) {
        // At this point, all the WHITE values should be correct letters guessed in the wrong spot
        if (result[i] === LetterResult.WHITE) {
            if (targetLetters.get(guess[i]) > 0) {
                targetLetters.set(guess[i], targetLetters.get(guess[i]) - 1);

                if (newYellowsCount.has(guess[i])) {
                    newYellowsCount.set(guess[i], yellows.get(guess[i]) + 1);
                } else {
                    newYellowsCount.set(guess[i], 1);
                }

                result[i] = LetterResult.YELLOW;
            } else {
                result[i] = LetterResult.GRAY;
            }

            // Whether it was found to be a yellow or a gray, add it to yellows so the letter can't be guessed here again
            yellows[i].add(guess[i]);

            // Take the max of yellowsCount and newYellowsCount for the letter
            if (yellowsCount.has(guess[i])) {
                yellowsCount.set(guess[i], Math.max(yellowsCount.get(guess[i]), newYellowsCount.get(guess[i])));
            } else {
                yellowsCount.set(guess[i], 1);
            }
        }
    }

    // Return computed result
    return result;
}

// CONTAINED LOGIC
// TODO: cacheIfContained; to minimize the number of api calls, we can cache words as we find them here instead of doing it sequentially


// Check if a word is contained in our word banks
// First check the local indexed db, then the redis cache, and finally the MongoDB
function isContained(word, wordLength, db) {
    let exists = false;
    let status = ContainedStatus.VALID;

    // Sequentially check locally, then Redis, then MongoDB
    ({ exists, status } = isContainedLocal(word, wordLength, db));

    if (exists || status !== ContainedStatus.VALID) {
        return { exists: exists, status: status };
    }

    ({ exists, status } = isContainedRedis(word, wordLength, db));

    if (exists || status !== ContainedStatus.VALID) {
        return { exists: exists, status: status };
    }

    ({ exists, status } = isContainedMongoDB(word, wordLength, db));

    if (exists || status !== ContainedStatus.VALID) {
        return { exists: exists, status: status };
    }

    // if none of these work, return false with valid status
    return { exists: exists, status: status };
}

// Check if a word is in the remote Redis cache
// TODO: Import from Redis.js

// Check if a word is in the remote MongoDB
// TODO: Some of these functions are a bit inconsistent with how they do the error handling, even if the logic is actually the same
// I like the look of this one, let's refactor everything to make it look like this

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
            await new Promise(res => setTimeout(res, 1000 * attempt));
        }
    }

    return { exists: false, status: ContainedStatus.REDIS_QUERY_FAILED };
}

async function isContainedLocal(word, wordLength, db) {
    // TODO: Search the local indexedDB for the words
    return false;
}


// WORD SELECTION

// Choose the word for the game
// If theme is selected, OpenAI API used to query LLM to generate word with that theme
// Else, MongoDB/Redis
async function chooseWord(wordLength, letterRestrict, letterGuarantee, specificRestrict, db, theme, prevWords, repeats) {

    if (theme) {
        return chooseWordThematic(wordLength, theme, db, prevWords, repeats);
    } else {
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


// TODO: Display text on screen indicating remote word search

async function chooseWordRemote(wordLength, letterRestrict, letterGuarantee, specificRestrict, db, prevWords, repeats) {
    let wordbank = [];
    let status = queryIsPossible(wordLength, letterRestrict, letterGuarantee, specificRestrict);

    if (status !== QueryStatus.VALID) {
        return {
            target: "",
            status: status,
        };
    }


    // If it's a complex query, don't try Local or Redis
    if (specificRestrict || letterRestrict || letterGuarantee) {
        ({ wordbank, status } = wordbank = await queryMongoDB(wordLength, letterRestrict, letterGuarantee, specificRestrict, db));

        if (status !== QueryStatus.VALID) {
            return {
                target: "",
                status: status,
            };
        }

    } else {
        // First, look locally

        // TODO: Implement when making PWA functionality
        // ({wordbank, status} = await queryLocal(wordLength, db));

        // If no words found locally, try Redis
        if (wordbank.length === 0) {
            ({ wordbank, status } = await queryRedis(wordLength, db));
            if (status !== QueryStatus.VALID) {
                return {
                    target: "",
                    status: status,
                };
            }
        }

        // Finally, query MongoDB
        if (wordbank.length === 0) {
            ({ wordbank, status } = await queryMongoDB(wordLength, letterRestrict, letterGuarantee, specificRestrict, db, repeats));
            if (status !== QueryStatus.VALID) {
                return {
                    target: "",
                    status: status,
                };
            }
        }
    }

    // If no valid words were found anywhere, then we can't pick a word
    if (wordbank.wordLength === 0) {
        return {
            target: "",
            status: QueryStatus.NO_WORDS_FOUND,
        };
    }

    // If word found, populate the Cache with words that would be relevant this game
    await populateRedisCache(wordLength, db);

    // Choose a word from the wordbank
    // If repeats aren't allowed, this will exclude the previous words
    return randomWord(wordbank, prevWords, repeats);
}

// Generate word from a theme (OpenAI)
// Experimentally, it works well enough with wordLength.
// TODO: Customizability for how loosely the words can be connected (we'll change the prompt + temperature)
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

        // Store found words in LocalStorage
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
// TODO: Extract this logic to a server-side module and call an API in the client code instead
// TODO: I don't know how much  I like that we're getting the WordModel here rather than using helper functions only,
// -- but, we do need to build that query, which requires a lot of Wordle-Specific logic
// -- potentially we'll refactor it later
async function queryMongoDB(wordLength, letterRestrict, letterGuarantee, specificRestrict, db) {
    let attempt = 0;

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
            if (letterRestrict && letterRestrict.size > 0) {
                const restrictedLetters = Array.from(letterRestrict).join('');

                // REGEX matching: this pattern matches any string with a restrictedLetter, so take not of that
                query.word = { $not: { $regex: `[${restrictedLetters}]` } };
            }

            // Filter out words that don't contain all guaranteed letters
            if (letterGuarantee && letterGuarantee.length > 0) {
                query.indices = { ...(query.indices || {}), $all: letterGuarantee };
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
            await new Promise(res => setTimeout(res, 1000 * attempt));
        }
    }
}

async function queryRedis(wordLength, db) {
    let words = [];
    let status;
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        try {
            words = await queryRedisCache(wordLength, db);
            status = QueryStatus.VALID;
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

// Move words of wordLength from db to local cache
// Not Redis, because our Redis cache is global right now
async function thematicCache(wordLength, theme) {
    // TODO: Store individual words as documents indexed by'theme'
}


// Ensure a query isn't contradctory before checking the database
// Other contradictions should be made impossible at the inputting parameters step
// TODO: There's a logic error here trying to find when the specific requirements make the lettersGuarantee impossible
function queryIsPossible(wordLength, letterRestrict, letterGuarantee, specificRestrict) {
    // Check for impossible sizes
    if (wordLength !== specificRestrict.length()) {
        return QueryStatus.ERR_LENGTH;
    }

    if (letterGuarantee.length > wordLength) {
        return QueryStatus.ERR_LETTER_GUARANTEE_TOO_LARGE
    }

    let specLetters = new Map();

    // Check for contradicitons between restrict/guarantee
    // Also build set to check against the guaranteed letters
    for (let i = 0; i < wordLength; i++) {
        if (letterRestrict.has(specificRestrict[i])) {
            return QueryStatus.ERR_LETTER_RESTRICT_SPECIFIC;
        }

        if (specLetters.has(specificRestrict[i])) {
            specLetters.set(specificRestrict[i], specLetters.get(specificRestrict[i]) + 1);
        } else {
            specLetters.set(specificRestrict[i], 1);
        }
    }


    // Check for contradicitons between restrict/guarantee/specificRestrict
    for (const letter of letterGuarantee) {
        if (letterRestrict.has(letter)) {
            return QueryStatus.ERR_LETTER_RESTRICT_GUARANTEE;
        }

        if (specLetters.has(letter)) {
            if (specLetters.get(letter) <= 0) {
                return QueryStatus.ERR_LETTER_GUARANTEE_SPECIFIC;
            }

            specLetters.set(letter, specLetters.get(letter) - 1);
        }

        return QueryStatus.VALID;
    }
}

// NOTE: The LLM doesn't seem to generate a long list of words ever
// If this changes, we'll edit the prompt


// TODO: Actually implement getting the API Key
// TODO: The error messages, and the format of the response
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
            await new Promise(res => setTimeout(res, 1000 * attempt));
        }
    }
}

// UTIL

// Get random word from array
function randomWord(wordbank, prevGuesses, repeats) {
    let word;

    while (wordbank.length > 0) {
        const index = Math.floor(Math.random() * wordbank.length);
        word = wordbank[index];
        wordbank.splice(index, 1);

        if (!repeats || !prevGuesses.has(word)) {
            return { target: word, status: QueryStatus.VALID };
        }
    }

    return { status: QueryStatus.NO_WORDS_FOUND };
}