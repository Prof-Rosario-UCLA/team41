import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import { chooseWord, checkWordExists} from '../api/WordleAPI';
// import { checkWordInDB } from '../utils/IndexedDB'; 
import { QueryStatus, GuessStatus, LetterResult } from '../Enums'; 
import { useGame } from '../hooks/Game'; 
import { isValid, checkGuess, queryIsPossible } from '../core/Wordle'

export const WordleContext = createContext();

export const WordleProvider = ({ children }) => {
    const { isDbReady, isOffline, userId, saveGame, loadGame, clearGame, getActiveGameId } = useGame();

    const [gameId, setGameId] = useState(null);
    const [db, setDB] = useState(null);
    const [wordLength, setWordLength] = useState(5);
    const [numGuesses, setNumGuesses] = useState(6);
    const [allowRepeats, setAllowRepeats] = useState(false); 
    const [letterRestrict, setLetterRestrict] = useState(new Set());
    const [letterGuarantee, setLetterGuarantee] = useState(new Array());
    const [specificRestrict, setSpecificRestrict] = useState("");
    const [theme, setTheme] = useState(null); 
    const [themeEnabled, setThemeEnabled] = useState(false); 

    const [board, setBoard] = useState([]); 
    const [currentGuessIndex, setCurrentGuessIndex] = useState(0); 
    const [greens, setGreens] = useState([]); 
    const [yellows, setYellows] = useState([]); 
    const [yellowsCount, setYellowsCount] = useState(new Map()); 
    const [grays, setGrays] = useState(new Set()); 
    const [prevGuesses, setPrevGuesses] = useState(new Set()); 
    const [hasWon, setHasWon] = useState(false);
    const [isOver, setIsOver] = useState(false);
    const [targetWord, setTargetWord] = useState(null); 
    const [gameType, setGameType] = useState(null); 

    const [message, setMessage] = useState(''); 
    const [isLoading, setIsLoading] = useState(false);
    const [paramsMenu, setParamsMenu] = useState(false);
    
    const [prevWords, setPrevWords] = useState(new Set());

    const isInitialMount = useRef(true);

    const clearGameState = useCallback(() => {
        setGameId(null);
        setDB(null);
        setWordLength(5);
        setNumGuesses(6);
        setAllowRepeats(false);
        setLetterRestrict(new Set());
        setLetterGuarantee(new Array());
        setSpecificRestrict("");
        setTheme(null);
        setThemeEnabled(false);
        setBoard([]);
        setCurrentGuessIndex(0);
        setGreens([]);
        setYellows([]);
        setYellowsCount(new Map());
        setGrays(new Set());
        setPrevGuesses(new Set());
        setHasWon(false);
        setIsOver(false);
        setTargetWord(null);
        setGameType(null);
        setMessage('');
        setIsLoading(false);
        setParamsMenu(false);
    }, []);

    const addWordToPrev = useCallback((word) => {
        setPrevWords((currentPrev) => {
            const newPrev = new Set(currentPrev); 
            newPrev.add(word.toLowerCase()); 
            return newPrev;
        });
    }, []);

    useEffect(() => {
        const loadActiveWordleGame = async () => {
            if (!isDbReady || !userId) {
                return;
            }

            try {
                const storedGameId = await getActiveGameId();
                if (storedGameId) {
                    const loadedState = await loadGame(storedGameId);
                    if (loadedState && !loadedState.isOver && loadedState.gameType === 'wordle') {
                        loadedState.prevGuesses = new Set(loadedState.prevGuesses || []);
                        loadedState.grays = new Set(loadedState.grays || []);
                        loadedState.yellows = (loadedState.yellows || []).map(arr => new Set(arr));
                        loadedState.yellowsCount = new Map(loadedState.yellowsCount || []);

                        setGameId(loadedState.gameId);
                        setDB(loadedState.db);
                        setWordLength(loadedState.wordLength);
                        setNumGuesses(loadedState.numGuesses);
                        setAllowRepeats(loadedState.allowRepeats || false); // Load new state
                        setLetterRestrict(loadedState.letterRestrict);
                        setLetterGuarantee(loadedState.letterGuarantee);
                        setSpecificRestrict(loadedState.specificRestrict);
                        setTheme(loadedState.theme || null); // Load new state
                        setThemeEnabled(loadedState.themeEnabled || false); // Load new state
                        setBoard(loadedState.board);
                        setCurrentGuessIndex(loadedState.currentGuessIndex);
                        setGreens(loadedState.greens);
                        setYellows(loadedState.yellows);
                        setYellowsCount(loadedState.yellowsCount);
                        setGrays(loadedState.grays);
                        setPrevGuesses(loadedState.prevGuesses);
                        setHasWon(loadedState.hasWon);
                        setIsOver(loadedState.isOver);
                        setTargetWord(loadedState.targetWord); 
                        setGameType(loadedState.gameType);
                        setParamsMenu(false);

                        setMessage('Game loaded from IndexedDB.');
                        console.log('Wordle game loaded from IndexedDB:', loadedState);
                        console.log("Online? ", isOffline);
                    } else if (loadedState && (loadedState.isOver || loadedState.hasWon)) {
                        console.log("Found completed Wordle game in IndexedDB, clearing it.");
                        await clearGame(storedGameId); 
                    }
                }
            } catch (error) {
                console.error("Failed to load Wordle game from IndexedDB:", error);
                setMessage("Could not load previous Wordle game.");
            } finally {
                isInitialMount.current = false;
            }
        };
        loadActiveWordleGame();
    }, [isDbReady, userId, isOffline, loadGame, getActiveGameId, clearGame]); 

    useEffect(() => {
        if (isInitialMount.current || !gameId || !isDbReady || !userId) {
            return;
        }

        const currentState = {
            gameId,
            db,
            wordLength,
            numGuesses,
            allowRepeats, 
            letterRestrict,
            letterGuarantee,
            specificRestrict,
            theme, 
            themeEnabled,
            board,
            currentGuessIndex,
            greens,
            yellows: yellows.map(set => Array.from(set)),
            yellowsCount: Array.from(yellowsCount.entries()),
            grays: Array.from(grays),
            prevGuesses: Array.from(prevGuesses),
            hasWon,
            isOver,
            gameType: 'wordle', 
            targetWord: targetWord,
        };

        saveGame(currentState)
            .then(() => console.log('Wordle game state saved to IndexedDB.'))
            .catch(error => console.error('Failed to save Wordle game state to IndexedDB:', error));
    }, [
        gameId, db, wordLength, numGuesses, allowRepeats, letterRestrict, letterGuarantee, specificRestrict,
        theme, themeEnabled, board, currentGuessIndex, greens, yellows, yellowsCount,
        grays, prevGuesses, hasWon, isOver, targetWord, gameType, isDbReady, userId, saveGame
    ]);

    const initializeGame = useCallback(async (params) => {
        setIsLoading(true);
        setMessage('');
        try {
            if (gameId && !isOver ) {
                await clearGame(gameId);
                console.log("Cleared previous Wordle game from IndexedDB.");
            }

            const {paramWordLength, paramNumGuesses, paramGameType, paramLetterRestrict,
                   paramLetterGuarantee, paramSpecificRestrict, paramDbSelection,
                   paramTheme, paramThemeEnabled, paramAllowRepeats} = params; 

            let queryErrMsg = null;
            const status = queryIsPossible(wordLength, letterRestrict, letterGuarantee, specificRestrict);
            if (status !== QueryStatus.VALID) {
                switch (status) {
                    case QueryStatus.ERR_LENGTH:
                        queryErrMsg = `Specific Requirements cannot be longer than the word length`;
                        break;
                    case QueryStatus.ERR_LETTER_GAURANTEE_TOO_LARGE:
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
                setMessage(queryErrMsg);
                setGameId(null); 
                return;
            } else {
                const chosenWord = await chooseWord({
                    wordLength: paramWordLength,
                    numGuesses: paramNumGuesses,
                    gameType: paramGameType, 
                    letterRestrict: paramLetterRestrict,
                    letterGuarantee: paramLetterGuarantee,
                    specificRestrict: paramSpecificRestrict,
                    db: paramDbSelection,
                    theme: paramThemeEnabled ? paramTheme : null, 
                    repeats: paramAllowRepeats,
                    prevWords: Array.from(prevWords),
                });
       
                if (chosenWord.status === "VALID") {
                    const newTarget = chosenWord.target;
                    console.log(chosenWord.target);
                    console.log("target is: ", newTarget);
                    const newBoard = Array.from({ length: paramNumGuesses || 6 }, () =>
                        Array.from({ length: paramWordLength || 5 }, () => ({ letter: '', status: 'empty' }))
                    );

                    const id = Math.floor(Math.random() * 1000000) + 1;

                    setGameId(id);
                    setDB(paramDbSelection);
                    setWordLength(paramWordLength);
                    setNumGuesses(paramNumGuesses);
                    setAllowRepeats(paramAllowRepeats); // Set new state
                    setLetterRestrict(new Set(paramLetterRestrict.split(''))); // Convert string to Set
                    setLetterGuarantee(Array.from(paramLetterGuarantee)); // Convert string to Array
                    setSpecificRestrict(paramSpecificRestrict);
                    setTheme(paramTheme); // Set new state
                    setThemeEnabled(paramThemeEnabled); // Set new state
                    setBoard(newBoard);
                    setCurrentGuessIndex(0);
                    setGreens(new Array(paramWordLength).fill(null)); // Initialize with nulls or empty strings
                    setYellows(Array.from({ length: paramWordLength }, () => new Set()));
                    setYellowsCount(new Map());
                    setGrays(new Set());
                    setPrevGuesses(new Set());
                    setHasWon(false);
                    setIsOver(false);
                    setGameType(paramGameType);
                    setTargetWord(newTarget); 
                    setMessage('Game start!');

                } else {
                    switch (chosenWord.status) {
                        case "NO_WORDS_FOUND":
                            queryErrMsg = `No words found meeting the requirements. Try different settings.`;
                            break;
                        case "ERR_OFFLINE_THEME":
                            queryErrMsg = `Must be online to select by theme.`;
                            break;
                        default:
                            console.warn("Unhandled chosenWord.status:", chosenWord.status);
                            queryErrMsg = 'Failed to start new Wordle game. An unexpected error occurred.';
                    }
                    setMessage(queryErrMsg);
                    setParamsMenu(true);
                }
            }
        } catch (error) {
            console.error('Error initializing Wordle game:', error);
            setMessage('Network error starting new Wordle game. Please check your connection.');
            setGameId(null); 
            setParamsMenu(true);
        } finally {
            setIsLoading(false);
            setParamsMenu(false);
        }
    }, [gameId, isOver, clearGame, prevWords, paramsMenu, queryIsPossible, chooseWord]); // Removed specific params that come from 'params'

    const submitGuess = useCallback(async (rawGuess) => {
        console.log("submitGuess received: gameId:", gameId, "db:", db, "wordLength:", wordLength, "targetWord:", targetWord, "currentGuessIndex:", currentGuessIndex);
        console.log("submitGuess start");
        if (!gameId || isLoading || isOver || !isDbReady ) {
            console.log(
                gameId,
                isLoading,
                isOver,
                isDbReady,
            )
            return;
        }
        
        const guess = rawGuess.toLowerCase();

        if (guess.length !== wordLength) {
            console.log("Length error");
            setMessage(`Guess must be ${wordLength} letters long.`);
            return;
        }
        if (prevGuesses.has(guess)) {
            console.log("Prev error");
            setMessage(`${guess} was guessed already!`);
            return;
        }
        
        console.log("S");
        let status = isValid(guess, wordLength, letterRestrict, letterGuarantee, specificRestrict, db, gameType, greens, yellows, yellowsCount, grays );
        let guessErrMsg; 

        console.log("status: ", status);

        if (status.status !== GuessStatus.VALID) {
            console.log(`Guess ${guess} was invalid for reason ${status.status}`);
            switch (status.status) { // Access status.status here
                case GuessStatus.ERR_LENGTH:
                    guessErrMsg = `Guess must be ${wordLength} letters long`;
                    break;
                case GuessStatus.ERR_PREV:
                    guessErrMsg = `${guess} was guessed already!`;
                    break;
                case GuessStatus.ERR_LETTER_RESTRICT:
                    guessErrMsg = `${guess} contains restricted letter '${status.letter}'`; // Use status.letter
                    break;
                case GuessStatus.ERR_LETTER_GAURANTEE:
                    guessErrMsg = `${guess} does not contain required letter '${status.letter}'`; // Use status.letter
                    break;
                case GuessStatus.ERR_SPECIFIC_RESTRICT_1:
                    guessErrMsg = `${guess} contradicts requirement: letter #${status.index} == ${specificRestrict[status.index]}`; // Use status.index
                    break;
                case GuessStatus.ERR_SPECIFIC_RESTRICT_2:
                    guessErrMsg = `${guess} contradicts requirement: letter #${status.index} =/= ${specificRestrict[status.index]}`; // Use status.index
                    break;
                case GuessStatus.ERR_GRAYS:
                    guessErrMsg = `The target does not include '${status.letter}'`; // Use status.letter
                    break;
                case GuessStatus.ERR_GREENS:
                    guessErrMsg = `${guess} does not include confirmed letter '${guess[status.index]}' at position ${status.index}`; // Use status.index
                    break;
                case GuessStatus.ERR_YELLOWS_CONTRADICT:
                    guessErrMsg = `The letter '${guess[status.index]}' does not appear at position ${status.index}`; // Use status.index
                    break;
                case GuessStatus.ERR_YELLOWS_MISSING:
                    guessErrMsg = `The target includes at least '${status.size}' of the letter ${status.letter}`; // Use status.size, status.letter
                    break;
                default:
                    guessErrMsg = "Invalid guess based on current game state.";
            }
            setMessage(guessErrMsg);
            return;
        }

        const contained = await checkWordExists(guess, wordLength, db);
        console.log("contained:", contained);

        if (contained.success) {
            console.log("SUccess!");
            setIsLoading(true);
            setMessage(''); 
            try {

                 const {
                    guessResult,
                    newGreens,
                    newYellows,
                    newYellowsCount,
                    newGrays,
                } = checkGuess(
                    guess, targetWord, greens, yellows, yellowsCount, grays, allowRepeats
                );
                const updatedBoard = [...board];
                let allGreen = true;
                console.log("checkGuess results", 
                    guessResult,
                    newGreens,
                    newYellows,
                    newYellowsCount,
                    newGrays,
                );
           
                updatedBoard[currentGuessIndex] = guessResult.map((resultStatus, index) => {
                    if (resultStatus !== 1) {allGreen = false;
                        console.log("Index wrong:", index);
                    }
                    return { letter: guess[index].toUpperCase(), status: resultStatus }; // Ensure uppercase for display
                });

                const newPrevGuesses = new Set(prevGuesses).add(guess);

                const justWon = allGreen;
                const justOver = justWon || (currentGuessIndex + 1 >= numGuesses);

                setBoard(updatedBoard);
                setCurrentGuessIndex(prev => prev + 1);
                setGreens(newGreens); // Assuming greens was modified by checkGuess or newGreens returned
                setYellows(newYellows); // Assuming yellows was modified by checkGuess or newYellows returned
                setYellowsCount(newYellowsCount); // Assuming yellowsCount was modified
                setGrays(newGrays); // Assuming grays was modified
                setPrevGuesses(newPrevGuesses);
                setHasWon(justWon);
                setIsOver(justOver);
                
                await saveGame({
                    gameId, wordLength, numGuesses, allowRepeats,
                    letterRestrict: Array.from(letterRestrict), // Convert Set to Array for storage
                    letterGuarantee, // Array already
                    specificRestrict, theme, themeEnabled,
                    board: updatedBoard, currentGuessIndex: currentGuessIndex + 1,
                    greens, yellows: yellows.map(s => Array.from(s)), yellowsCount: Array.from(yellowsCount.entries()),
                    grays: Array.from(grays), prevGuesses: Array.from(newPrevGuesses),
                    hasWon: justWon, isOver: justOver, gameType, targetWord 
                });

                if (justWon) {
                    setMessage(`Game Won! You won in ${currentGuessIndex + 1} guesses!`);
                    await clearGame(gameId);
                } else if (justOver) {
                    setMessage(`Game over! The word was ${targetWord.toUpperCase()}.`);
                    await clearGame(gameId);
                } else {
                    setMessage('');
                }
            } catch (error) {
                console.error('Error submitting Wordle guess:', error);
                if (isOffline) {
                    setMessage('You appear to be offline. Cannot submit guess to server.');
                } else {
                    setMessage('Network error submitting guess. Please try again.');
                }
            } finally {
                setIsLoading(false);
            }
        } else {
            console.log("Not found :(");
            if (contained.status === "VALID") {
                setMessage(`${guess} is not a valid word`);
            } else {
                setMessage(contained.status);
            }
        }
    }, [
        gameId, isLoading, db, hasWon, isOver, wordLength, prevGuesses, board, currentGuessIndex,
        targetWord, gameType, greens, yellows, yellowsCount, grays, isDbReady, userId,
        isOffline, saveGame, clearGame, allowRepeats, letterRestrict, letterGuarantee, specificRestrict, theme, themeEnabled, 
        isValid, setMessage, checkGuess, checkWordExists,
    ]);

    const contextValue = {
        gameId, wordLength, numGuesses, board, currentGuessIndex,
        greens, yellows, yellowsCount, grays, prevGuesses,
        hasWon, isOver, message, isLoading, db,
        gameType, targetWord, prevWords, allowRepeats, theme, themeEnabled,
        letterRestrict, letterGuarantee, specificRestrict, paramsMenu,
        initializeGame, submitGuess, setMessage, clearGameState, addWordToPrev,
    };

    return (
        <WordleContext.Provider value={contextValue}>
            {children}
        </WordleContext.Provider>
    );
};
