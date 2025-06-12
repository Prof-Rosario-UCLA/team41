import React, { useState, useEffect, useCallback } from 'react';
import { useWordle } from '../hooks/Wordle.js';
import { WordleProvider } from '../context/Wordle';
import Grid from '../components/Grid.jsx';
import Keyboard from '../components/Keyboard.jsx';
import Parameters from '../components/Parameters.jsx';
import './Wordle.css'; 

const WordleGame = () => {
    const {
        wordLength, numGuesses, board, currentGuessIndex,
        greens, yellows, grays,
        hasWon, isOver, message, isLoading,
        initializeGame, submitGuess, setMessage,
        clearGameState, paramsMenu,
    } = useWordle();

    const [showSettings, setShowSettings] = useState(true);
    const [inputGuess, setInputGuess] = useState('');

    useEffect(() => {

        if ( wordLength && numGuesses && board.length > 0 && !hasWon && !isOver && !isLoading) {
            setShowSettings(false);
        }
    }, [wordLength, numGuesses, board, hasWon, isOver, isLoading]);


    const handleNewGameStart = async (settings) => {
        await initializeGame(settings);
        console.log("paramsMenu", paramsMenu);
        if (!paramsMenu) {
            setShowSettings(false);
            setInputGuess('');
            console.log("settings: ", settings);
        }
    };

    const handleKeyPress = useCallback((key) => {
        if (hasWon || isOver || isLoading) return;

        if (key === 'ENTER') {
            handleGuessSubmit();
        } else if (key === 'BACKSPACE') {
            setInputGuess((prev) => prev.slice(0, -1));
        } else if (key.length === 1 && key.match(/[A-Z]/i)) {
            if (inputGuess.length < wordLength) {
                setInputGuess((prev) => prev + key.toUpperCase());
            }
        }
    }, [inputGuess, wordLength, hasWon, isOver, isLoading]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!showSettings) {
                handleKeyPress(event.key.toUpperCase());
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyPress, showSettings]);

    const handleGuessSubmit = () => {
        if (!inputGuess || inputGuess.length !== wordLength) {
            setMessage(`Please enter a ${wordLength}-letter word.`);
            return;
        }
        console.log("ENTER")
        submitGuess(inputGuess);
        setInputGuess('');
    };

    // Create a temporary board for display that includes the current inputGuess
    const displayBoard = board.map((row, rowIndex) => {
        if (rowIndex === currentGuessIndex && !isOver && !hasWon) {
            const newRow = [...row];
            for (let i = 0; i < wordLength; i++) {
                newRow[i] = {
                    letter: inputGuess[i] || '', // Use letter from inputGuess, or empty string
                    status: 'empty' // Always 'empty' status for currently typed letters
                };
            }
            return newRow;
        }
        return row;
    });


    if (showSettings || isLoading) {
        return (
            <div className="wordle-initial-container">
                {showSettings && <Parameters onStartGame={handleNewGameStart} message={message} />}
                {isLoading && (
                    <p className="loading-message">Loading game...</p>
                )}
            </div>
        );
    }

    return (
        <div className="wordle-game-container">
            <h1 className="game-title">Customizyrdle</h1>

            {isLoading && <p className="game-loading-text">Loading...</p>}
            {message && (
                <p className={`game-message ${
                    hasWon ? 'message-won' :
                    isOver ? 'message-lost' :
                    'message-info'
                }`}>
                    {message}
                </p>
            )}

            <Grid
                board={displayBoard} // Pass the displayBoard
                currentGuessIndex={currentGuessIndex}
                wordLength={wordLength}
                numGuesses={numGuesses}
            />

            <div className="controls-wrapper">
                {/* The input field is still here for accessibility/copy-pasting */}
                <input
                    type="text"
                    value={inputGuess}
                    // onChange={(e) => setInputGuess(e.target.value.toUpperCase())} // Disable direct typing to input to rely solely on keyboard
                    className="guess-input"
                    maxLength={wordLength || 5}
                    // disabled={true} /* Disable direct input to rely on virtual keyboard */
                    placeholder={`Type your ${wordLength || '?'}-letter guess`}
                />
                <button
                    onClick={handleGuessSubmit}
                    className="submit-button"
                    disabled={isLoading || !wordLength || hasWon || isOver || inputGuess.length !== wordLength}
                >
                    Submit Guess
                </button>
                <button
                    onClick={() => {
                        setShowSettings(true);
                        clearGameState();
                        setMessage("");
                    }}
                    className="change-settings-button"
                >
                    Change Settings
                </button>
            </div>

            <Keyboard onKeyPress={handleKeyPress} greens={greens} yellows={yellows} grays={grays} />
        </div>
    );
};

// This wraps the Wordle game with the context provider WordleProvider
const Wordle = () => {
    return (
        <WordleProvider>
            <WordleGame />
        </WordleProvider>
    );
};

export default Wordle;
