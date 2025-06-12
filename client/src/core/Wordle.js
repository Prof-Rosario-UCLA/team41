// BUISNESS LOGIC FOR WORDLE THAT THE CLIENT RINS
// TODO: EXTRACT EVERYTHING HERE TO ONE LIB MODULE BOTH THE CLIENT AND SERVER WILL RUN

import { GameMode, GuessStatus, QueryStatus, LetterResult } from '../Enums.js';

// Check whether the user's guess was a valid guess
// FEAT: Check against specific word pools for 'theme' mode
// TODO: Check this function experimentally. I believe it's correct, but need to verify emprically
export function isValid(rawGuess, wordLength, letterRestrict, letterGuarantee, specificRestrict, db, mode, greens, yellows, yellowsCount, grays) {
    console.log(`isValid found guess '${rawGuess}', wordLength '${wordLength}', letterRestrict '${letterRestrict}', letterGuarantee ${letterGuarantee}', specificRestrict '${specificRestrict}', db '${db}', mode '${mode}'`);
    console.log("grays:", grays);
    console.log("greens:", greens);
    console.log("yellows:", yellows);
    // Normalize guess (shouldn't be necessary but feels like good practice)
    let guess = rawGuess.toLowerCase();

    // If the game mode is hard, don't allow guesses contradicting established information
    // TODO: Add more granularity here
    // -- regular 'hard' mode: can't make guesses contradicting established information
    // -- extra 'hard' mode: can't make guesses contradicting the parameters either
    // -- extra 'regular' mode: can make guesses contradicitng established info but not the parameters
    if (mode === 'hard') {
        console.log("HARD");
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
            if (specificRestrict[i] && specificRestrict[i] !== '_') {
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
            if (greens[i] && greens[i] !== '_' && guess[i] !== greens[i]) {
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
                    if (guess[i] === letter) {
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

    // If all these checks pass, the word doesn't contradict established info
    return {
        guess: guess,
        status: GuessStatus.VALID,
    };
}

// Ensure a query isn't contradctory before checking the database
// Other contradictions should be made impossible at the inputting parameters step
// TODO: There's a logic error here trying to find when the specific requirements make the lettersGuarantee impossible
export function queryIsPossible(wordLength, letterRestrict, letterGuarantee, specificRestrict) {
    // Check for impossible sizes

    if (specificRestrict && wordLength !== specificRestrict.length) {
        return QueryStatus.ERR_LENGTH;
    }

    if (letterGuarantee && letterGuarantee.length > wordLength) {
        return QueryStatus.ERR_LETTER_GUARANTEE_TOO_LARGE
    }

    let specLetters = new Map();

    // Check for contradicitons between restrict/guarantee
    // Also build set to check against the guaranteed letters
    if (specificRestrict) {
        for (let i = 0; i < wordLength; i++) {
            if (letterRestrict && letterRestrict.has(specificRestrict[i])) {
                return QueryStatus.ERR_LETTER_RESTRICT_SPECIFIC;
            }

            if (specLetters.has(specificRestrict[i])) {
                specLetters.set(specificRestrict[i], specLetters.get(specificRestrict[i]) + 1);
            } else {
                specLetters.set(specificRestrict[i], 1);
            }
        }
    }

    if (letterGuarantee) {
        // Check for contradicitons between restrict/guarantee/specificRestrict
        for (const letter of letterGuarantee) {
            if (letterRestrict.has(letter)) {
                return QueryStatus.ERR_LETTER_RESTRICT_GUARANTEE;
            }

            if (specLetters && specLetters.has(letter)) {
                if (specLetters.get(letter) <= 0) {
                    return QueryStatus.ERR_LETTER_GUARANTEE_SPECIFIC;
                }

                specLetters.set(letter, specLetters.get(letter) - 1);
            }
        }
    }

    console.log(QueryStatus.VALID);
    return QueryStatus.VALID;
}


// Check a guess against the target
// TODO: Check this function experimentally. I believe it's correct, but need to verify emprically
export function checkGuess(guess, target, greens, yellows, yellowsCount, grays) {
    let guessResult = new Array(guess.length).fill(LetterResult.WHITE);
    let newYellowsCount = new Map();
    let newGreens = [];
    let newGrays = new Set();
    let newYellows = new Array(guess.length);

    for (let i = 0; i < guess.length; i++) {
        newYellows[i] = new Set();
    }


    console.log("checkGuess params:", 
        guess, target, greens, yellows, yellowsCount, grays
    )

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
                guessResult[i] = LetterResult.GREEN;
                newGreens[i] = guess[i];
                targetLetters.set(guess[i], targetLetters.get(guess[i]) - 1);

                // Decrement yellowsCount, as we've found this letter to be a green, not a yellow
                if (yellowsCount.has(guess[i]) && yellowsCount.get(guess[i] > 0)) {
                    yellowsCount.set(yellowsCount.get(guess[i]), yellowsCount.get(guess[i]) - 1);
                }
            }
        } else {
            guessResult[i] = LetterResult.GRAY;
            // newGreens[i] = '_';
            newGrays.add(guess[i]);
        }
    }

    // Compute the yellows values
    for (let i = 0; i < guess.length; i++) {
        // At this point, all the WHITE values should be correct letters guessed in the wrong spot
        if (guessResult[i] === LetterResult.WHITE) {
            if (targetLetters.get(guess[i]) > 0) {
                targetLetters.set(guess[i], targetLetters.get(guess[i]) - 1);

                if (newYellowsCount.has(guess[i])) {
                    newYellowsCount.set(guess[i], yellows.get(guess[i]) + 1);
                } else {
                    newYellowsCount.set(guess[i], 1);
                }

                guessResult[i] = LetterResult.YELLOW;
            } else {
                guessResult[i] = LetterResult.GRAY;
            }

            // Whether it was found to be a yellow or a gray, add it to yellows so the letter can't be guessed here again
            newYellows[i].add(guess[i]);

            // Take the max of yellowsCount and newYellowsCount for the letter
            if (yellowsCount.has(guess[i])) {
                newYellowsCount.set(guess[i], Math.max(yellowsCount.get(guess[i]), newYellowsCount.get(guess[i])));
            } 
        }
    }
    
    for (let i = 0; i < guess.length; i++) {
        newYellows[i] = new Set();
    } 

    console.log("checkGuess results:", 
        guessResult, newGreens, newYellows, newYellowsCount, newGrays
    )
    // Return computed result
    return {guessResult, newGreens, newYellows, newYellowsCount, newGrays} ;
}