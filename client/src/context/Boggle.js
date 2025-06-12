// client/src/context/GameContext.jsx

import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import { chooseWordApi, submitGuessApi, loadGameApi } from '../services/gameApi';
// Import new IndexedDB game session functions
import { openAppDB, saveGameSession, loadGameSession, clearGameSession, getActiveGameId } from '../utils/indexedDb';
import { LetterResult } from '../utils/frontendEnums';
import { checkWordInDB } from '../utils/indexedDb'; // Keep for dictionary check


const GameContext = createContext();

export const GameProvider = ({ children }) => {
    // Initial state setup for React. Actual loading will happen in useEffect.
    const [gameId, setGameId] = useState(null);
    const [wordLength, setWordLength] = useState(5);
    const [numGuesses, setNumGuesses] = useState(6);
    const [board, setBoard] = useState([]);
    const [currentGuessIndex, setCurrentGuessIndex] = useState(0);
    const [greens, setGreens] = useState([]);
    const [yellows, setYellows] = useState([]);
    const [yellowsCount, setYellowsCount] = useState(new Map());
    const [grays, setGrays] = useState(new Set());
    const [prevGuesses, setPrevGuesses] = useState(new Set());
    const [hasWon, setHasWon] = useState(false);
    const [isOver, setIsOver] = useState(false);
    const [targetWord, setTargetWord] = useState(null); // Only for custom offline games
    const [gameType, setGameType] = useState(null); // 'daily' or 'custom'

    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDbReady, setIsDbReady] = useState(false); // New: to track if IndexedDB is ready
    const [isOfflineMode, setIsOfflineMode] = useState(false); // New: to track current network status awareness


    // Ref to prevent initial save on mount before state is fully initialized from DB/backend
    const isInitialMount = useRef(true);

    // Effect 1: Open IndexedDB and try to load any active game on initial mount
    useEffect(() => {
        const initializeAndLoadGame = async () => {
            try {
                await openAppDB();
                setIsDbReady(true);
                console.log("IndexedDB for app opened.");

                const storedGameId = await getActiveGameId(); // Try to get an active game ID
                if (storedGameId) {
                    const loadedState = await loadGameSession(storedGameId);
                    if (loadedState && !loadedState.isOver && !loadedState.hasWon) {
                        // Reconstruct non-JSON-serializable types from loaded state
                        loadedState.prevGuesses = new Set(loadedState.prevGuesses || []);
                        loadedState.grays = new Set(loadedState.grays || []);
                        loadedState.yellows = (loadedState.yellows || []).map(arr => new Set(arr));
                        loadedState.yellowsCount = new Map(loadedState.yellowsCount || []);

                        // Populate React state from IndexedDB
                        setGameId(loadedState.gameId);
                        setWordLength(loadedState.wordLength);
                        setNumGuesses(loadedState.numGuesses);
                        setBoard(loadedState.board);
                        setCurrentGuessIndex(loadedState.currentGuessIndex);
                        setGreens(loadedState.greens);
                        setYellows(loadedState.yellows);
                        setYellowsCount(loadedState.yellowsCount);
                        setGrays(loadedState.grays);
                        setPrevGuesses(loadedState.prevGuesses);
                        setHasWon(loadedState.hasWon);
                        setIsOver(loadedState.isOver);
                        setTargetWord(loadedState.targetWord); // Load target for custom games
                        setGameType(loadedState.gameType);

                        setMessage('Game loaded from IndexedDB.');
                        console.log('Game loaded from IndexedDB:', loadedState);

                        // If it's a daily game, or a custom game that was interrupted, try to sync with backend
                        if (loadedState.gameType === 'daily' || navigator.onLine) {
                            console.log("Attempting to sync with backend...");
                            // Potentially call loadGameApi to get latest backend state or verify
                            // This would be `loadGameApi(loadedState.gameId)` and reconcile.
                            // For daily games, you'd overwrite local state with authoritative server state.
                            // For custom, if online, you might just ensure it's still active.
                        }
                    } else if (loadedState && (loadedState.isOver || loadedState.hasWon)) {
                        console.log("Found completed game in IndexedDB, clearing it.");
                        await clearGameSession(storedGameId); // Clear completed games from IndexedDB
                    }
                }
            } catch (error) {
                console.error("Failed to initialize IndexedDB or load game:", error);
                setMessage("Could not load previous game. Offline features might be limited.");
                setIsDbReady(false);
            } finally {
                // This ensures isInitialMount is handled only after the first load attempt
                isInitialMount.current = false;
            }
        };
        initializeAndLoadGame();
    }, []); // Runs once on mount

    // Effect 2: Save state to IndexedDB whenever game-related state changes (after initial mount)
    useEffect(() => {
        if (isInitialMount.current || !gameId || !isDbReady) {
            return; // Don't save on initial mount or if no game/DB not ready
        }

        const stateToSave = {
            gameId,
            wordLength,
            numGuesses,
            board,
            currentGuessIndex,
            greens,
            yellows: yellows.map(set => Array.from(set)), // Convert Set to Array for IndexedDB
            yellowsCount: Array.from(yellowsCount.entries()), // Convert Map to Array for IndexedDB
            grays: Array.from(grays), // Convert Set to Array for IndexedDB
            prevGuesses: Array.from(prevGuesses), // Convert Set to Array for IndexedDB
            hasWon,
            isOver,
            gameType,
            // Only save targetWord to IndexedDB for 'custom' games, if it exists
            ...(gameType === 'custom' && { targetWord: targetWord }),
        };

        saveGameSession(stateToSave)
            .then(() => console.log('Game state saved to IndexedDB.'))
            .catch(error => console.error('Failed to save game state to IndexedDB:', error));
    }, [gameId, wordLength, numGuesses, board, currentGuessIndex, greens, yellows, yellowsCount, grays, prevGuesses, hasWon, isOver, targetWord, gameType, isDbReady]); // Dependencies


    const initializeGame = useCallback(async (params) => {
        setIsLoading(true);
        setMessage('');
        try {
            // First, clear any existing game state from IndexedDB if not already over
            if (gameId && !isOver && !hasWon) {
                 await clearGameSession(gameId);
                 console.log("Cleared previous game from IndexedDB.");
            }

            const data = await chooseWordApi(params); // Backend creates GameSession
            if (data.success) {
                const newBoard = Array.from({ length: params.numGuesses || 6 }, () =>
                    Array.from({ length: params.wordLength || 5 }, () => ({ letter: '', status: 'empty' }))
                );
                // Reset all local state
                setGameId(data.gameId);
                setWordLength(params.wordLength || 5);
                setNumGuesses(params.numGuesses || 6);
                setBoard(newBoard);
                setCurrentGuessIndex(0);
                setGreens(new Array(params.wordLength || 5).fill('_'));
                setYellows(Array.from({ length: params.wordLength || 5 }, () => new Set()));
                setYellowsCount(new Map());
                setGrays(new Set());
                setPrevGuesses(new Set());
                setHasWon(false);
                setIsOver(false);
                setGameType(data.gameType);
                if (data.gameType === 'custom' && data.targetWord) {
                    setTargetWord(data.targetWord);
                } else {
                    setTargetWord(null);
                }
                setMessage('Game started!');

            } else {
                setMessage(data.message || 'Failed to start new game.');
            }
        } catch (error) {
            console.error('Error initializing game:', error);
            setMessage('Network error starting new game.');
            // On network error for new game, clear gameId if it was set
            setGameId(null);
        } finally {
            setIsLoading(false);
        }
    }, [gameId, hasWon, isOver]); // Added gameId, hasWon, isOver as dependencies

    const submitGuess = useCallback(async (guess) => {
        if (!gameId || isLoading || hasWon || isOver || !isDbReady) return; // Ensure DB is ready

        const normalizedGuess = guess.toLowerCase();

        // Basic client-side validation
        if (normalizedGuess.length !== wordLength) {
            setMessage(`Guess must be ${wordLength} letters long.`);
            return;
        }
        if (prevGuesses.has(normalizedGuess)) {
            setMessage(`${normalizedGuess} was guessed already!`);
            return;
        }

        // --- Handle Custom Offline Game ---
        if (gameType === 'custom' && !navigator.onLine && targetWord) {
            console.log("Custom game: performing local guess check (offline).");
            setIsOfflineMode(true);
            setMessage('You are offline. Checking guess locally.');

            // Perform local dictionary check via IndexedDB
            const isWordValidLocally = await checkWordInDB(normalizedGuess);
            if (!isWordValidLocally) {
                setMessage('Guess was not a valid word (offline dictionary).');
                return;
            }

            // Perform local `checkGuessFrontend` logic using the locally stored targetWord
            const newGreens = [...greens];
            const newYellows = yellows.map(set => new Set(set));
            const newYellowsCount = new Map(yellowsCount);
            const newGrays = new Set(grays);

            const localGuessResult = checkGuessFrontend(
                normalizedGuess, targetWord, newGreens, newYellows, newYellowsCount, newGrays
            );

            const updatedBoard = [...board];
            let allGreen = true;
            updatedBoard[currentGuessIndex] = localGuessResult.map((status, index) => {
                if (status !== LetterResult.GREEN) allGreen = false;
                return { letter: normalizedGuess[index], status: status };
            });

            const newPrevGuesses = new Set(prevGuesses).add(normalizedGuess);

            const localHasWon = allGreen;
            const localIsOver = localHasWon || (currentGuessIndex + 1 >= numGuesses);

            // Update React state
            setBoard(updatedBoard);
            setCurrentGuessIndex(prev => prev + 1);
            setGreens(newGreens);
            setYellows(newYellows);
            setYellowsCount(newYellowsCount);
            setGrays(newGrays);
            setPrevGuesses(newPrevGuesses);
            setHasWon(localHasWon);
            setIsOver(localIsOver);

            // Update IndexedDB immediately with the new local game state
            await saveGameSession({
                gameId, wordLength, numGuesses, board: updatedBoard, currentGuessIndex: currentGuessIndex + 1,
                greens: newGreens, yellows: newYellows.map(s => Array.from(s)), yellowsCount: Array.from(newYellowsCount.entries()),
                grays: Array.from(newGrays), prevGuesses: Array.from(newPrevGuesses),
                hasWon: localHasWon, isOver: localIsOver, gameType, targetWord // Crucial to save targetWord here
            });


            if (localHasWon) {
                setMessage('You won your custom game (offline)!');
                await clearGameSession(gameId); // Clear if game ends
            } else if (localIsOver) {
                setMessage(`Custom game over (offline)! The word was ${targetWord.toUpperCase()}.`);
                await clearGameSession(gameId);
            } else {
                setMessage('');
            }

            setIsLoading(false);
            return; // Exit, as we handled it offline
        }

        // --- Standard online guess submission (for Daily or when online Custom) ---
        setIsOfflineMode(false); // Assume online if we're hitting the API
        setIsLoading(true);

        try {
            const data = await submitGuessApi(gameId, normalizedGuess);
            if (data.success) {
                // Update state from backend's authoritative response
                setBoard(data.board);
                setCurrentGuessIndex(data.currentGuessIndex);
                setGreens(data.greens);
                setYellows(data.yellows.map(arr => new Set(arr)));
                setYellowsCount(new Map(data.yellowsCount));
                setGrays(new Set(data.grays));
                setPrevGuesses(new Set(data.prevGuesses));
                setHasWon(data.hasWon);
                setIsOver(data.isOver);
                setMessage(data.message || (data.hasWon ? 'You won!' : (data.isOver ? `Game over! The word was ${data.targetWord}` : '')));
                setTargetWord(data.targetWord || null); // Backend might send targetWord on game over for daily

                if (data.isOver) {
                    await clearGameSession(gameId); // Clear from IndexedDB if game finished online
                }
            } else {
                setMessage(data.message || 'Invalid guess by server rules.');
            }
        } catch (error) {
            console.error('Error submitting guess:', error);
            if (!navigator.onLine) {
                setMessage('You appear to be offline. Cannot submit guess to server.');
                setIsOfflineMode(true); // Set offline mode flag
            } else {
                setMessage('Network error submitting guess. Please try again.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [
        gameId, isLoading, hasWon, isOver, wordLength, prevGuesses, board, currentGuessIndex,
        targetWord, gameType, greens, yellows, yellowsCount, grays, isDbReady // Added isDbReady
    ]);


    // Your `checkGuessFrontend` function (remains the same)
    const checkGuessFrontend = (guess, target, greens, yellows, yellowsCount, grays) => {
        // ... (your existing checkGuess logic) ...
        const result = new Array(guess.length).fill(LetterResult.GRAY);
        const tempTargetLetters = new Map();

        for (const char of target) {
            tempTargetLetters.set(char, (tempTargetLetters.get(char) || 0) + 1);
        }

        for (let i = 0; i < guess.length; i++) {
            if (guess[i] === target[i]) {
                result[i] = LetterResult.GREEN;
                greens[i] = guess[i];
                tempTargetLetters.set(guess[i], tempTargetLetters.get(guess[i]) - 1);
            }
        }

        for (let i = 0; i < guess.length; i++) {
            if (result[i] === LetterResult.GRAY) {
                if (tempTargetLetters.has(guess[i]) && tempTargetLetters.get(guess[i]) > 0) {
                    result[i] = LetterResult.YELLOW;
                    yellows[i].add(guess[i]);
                    yellowsCount.set(guess[i], (yellowsCount.get(guess[i]) || 0) + 1);
                    tempTargetLetters.set(guess[i], tempTargetLetters.get(guess[i]) - 1);
                } else {
                    grays.add(guess[i]);
                }
            }
        }
        return result;
    };


    const contextValue = {
        gameId, wordLength, numGuesses, board, currentGuessIndex,
        greens, yellows, yellowsCount, grays, prevGuesses,
        hasWon, isOver, message, isLoading,
        gameType, targetWord, // Expose these
        isOfflineMode, isDbReady, // Expose DB status
        initializeGame, submitGuess,
        setMessage, // For direct message setting
        // ... other setters if needed for GameSettings or other components
    };

    return (
        <GameContext.Provider value={contextValue}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => useContext(GameContext);