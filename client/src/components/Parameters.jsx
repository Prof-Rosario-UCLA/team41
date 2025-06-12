import React, { useState } from 'react';
import './Parameters.css'; 

const Parameters = ({ onStartGame, message }) => {
    const [wordLength, setWordLength] = useState(5);
    const [numGuesses, setNumGuesses] = useState(6);
    const [allowRepeats, setAllowRepeats] = useState(false);
    const [letterRestrict, setLetterRestrict] = useState('');
    const [letterGuarantee, setLetterGuarantee] = useState('');
    const [specificRestrict, setSpecificRestrict] = useState('');
    const [dbSelection, setDbSelection] = useState(1);
    const [themeInput, setThemeInput] = useState('');
    const [themeEnabled, setThemeEnabled] = useState(false);
    const [gameType, setGameType] = useState(false);

    const handleSubmit = (e) => {
        // TODO: Right now, we're just card
        let gameMode; 

        if (gameType) {
            gameMode = 'hard';
        } else {
            gameMode = 'normal';
        }

        e.preventDefault();
        onStartGame({
            paramWordLength: wordLength,
            paramNumGuesses: numGuesses,
            paramAllowRepeats: false,
            paramLetterRestrict: letterRestrict.toUpperCase(),
            paramLetterGuarantee: letterGuarantee.toUpperCase(),
            paramSpecificRestrict: specificRestrict.toUpperCase(),
            paramDbSelection: 1,
            paramTheme: themeInput.toLowerCase(),
            paramThemeEnabled: themeEnabled,
            paramGameType: gameMode,
        });
    };

    return (
        <div className="parameters-page-container">
            <form onSubmit={handleSubmit} className="parameters-form">
                <h2 className="form-title">
                    Wordle Settings
                </h2>

                {message && (
                    <p className="message-error">
                        {message}
                    </p>
                )}

                <div className="form-group">
                    <label htmlFor="wordLength" className="form-label">
                        Word Length: {wordLength}
                    </label>
                    <input
                        type="range"
                        id="wordLength"
                        className="form-range w-full"
                        value={wordLength}
                        onChange={(e) => setWordLength(Number(e.target.value))}
                        min="3"
                        max="10"
                        required
                    />
                </div>

               <div className="form-group">
                    <label htmlFor="numGuesses" className="form-label">
                        Number of Guesses: {numGuesses}
                    </label>
                    <input
                        type="range"
                        id="numGuesses"
                        className="form-slider"
                        value={numGuesses}
                        onChange={(e) => setNumGuesses(Number(e.target.value))}
                        min="3"
                        max="10"
                        required
                    />
                </div>
                <div className="form-group-checkbox">
                    <input
                        type="checkbox"
                        id="allowRepeats"
                        checked={allowRepeats}
                        onChange={(e) => setAllowRepeats(e.target.checked)}
                        className="form-checkbox"
                    />
                    <label htmlFor="allowRepeats" className="form-label-checkbox">
                        Allow Repeats in Target Word
                    </label>
                </div>

                <div className="form-group-checkbox">
                    <input
                        type="checkbox"
                        id="hardMode"
                        checked={gameType}
                        onChange={(e) => setGameType(e.target.checked)}
                        className="form-checkbox"
                    />
                    <label htmlFor="hardMode" className="form-label-checkbox">
                        Play on Hard Mode
                    </label>
                </div>

                <h3 className="section-title">Custom Word Rules</h3>

                <div className="form-group">
                    <label htmlFor="letterRestrict" className="form-label">
                        Letters NOT in word
                    </label>
                    <input
                        type="text"
                        id="letterRestrict"
                        className="form-input"
                        value={letterRestrict}
                        onChange={(e) => setLetterRestrict(e.target.value.replace(/[^A-Za-z]/g, ''))}
                        placeholder="e.g., 'xyz' (no spaces, no commas)"
                    />
                    <p className="form-helper-text">Letters that cannot appear anywhere in the word.</p>
                </div>

                <div className="form-group">
                    <label htmlFor="letterGuarantee" className="form-label">
                        Letters GUARANTEED in word
                    </label>
                    <input
                        type="text"
                        id="letterGuarantee"
                        className="form-input"
                        value={letterGuarantee}
                        onChange={(e) => setLetterGuarantee(e.target.value.replace(/[^A-Za-z]/g, ''))}
                        placeholder="e.g., 'ab' (no spaces, no commas)"
                    />
                    <p className="form-helper-text">Letters that must appear at least once.</p>
                </div>

                <div className="form-group">
                    <label htmlFor="specificRestrict" className="form-label">
                        Specific Restrictions
                    </label>
                    <input
                        type="text"
                        id="specificRestrict"
                        className="form-input"
                        value={specificRestrict}
                        onChange={(e) => {
    
                                    const raw = e.target.value.toUpperCase();
                                    const filtered = raw.replace(/[^A-Z_]/g, ''); // only A-Z and _
                                    setSpecificRestrict(filtered);
                                }
                        }
                        maxLength={wordLength}
                        placeholder={`e.g., A_PLE (total ${wordLength} characters, use _ for unknown)`}
                    />
                    <p className="form-helper-text">Enter a pattern. Use '_' for unknown letters. Must be {wordLength} characters.</p>
                </div>

                <div className="form-group">
                    <label htmlFor="dbSelection" className="form-label">
                        Database ID
                    </label>
                    <input
                        type="number"
                        id="dbSelection"
                        className="form-input"
                        value={dbSelection}
                        onChange={(e) => setDbSelection(Number(e.target.value))}
                        min="1"
                        placeholder="e.g., 1"
                    />
                    <p className="form-helper-text">Select a specific dictionary for word selection.</p>
                </div>

                <div className="form-group-checkbox">
                    <input
                        type="checkbox"
                        id="themeEnabled"
                        checked={themeEnabled}
                        onChange={(e) => setThemeEnabled(e.target.checked)}
                        className="form-checkbox"
                    />
                    <label htmlFor="themeEnabled" className="form-label-checkbox">
                        Choose word by theme
                    </label>
                    <p className="form-helper-text-inline">
                        (Note: This will override any other restrictions imposed)
                    </p>
                </div>

                {themeEnabled && (
                    <div className="form-group">
                        <label htmlFor="themeInput" className="form-label">
                            Theme
                        </label>
                        <input
                            type="text"
                            id="themeInput"
                            className="form-input"
                            value={themeInput}
                            onChange={(e) => setThemeInput(e.target.value)}
                            placeholder="e.g., animals"
                            required={themeEnabled}
                        />
                    </div>
                )}

                <button
                    type="submit"
                    className="submit-button"
                >
                    Start Game
                </button>
            </form>
        </div>
    );
};

export default Parameters;
