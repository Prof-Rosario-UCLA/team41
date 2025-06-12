import React from 'react';
import './Keyboard.css'; 

const Keyboard = ({ onKeyPress, greens, yellows, grays }) => {
    const keyboardRows = [
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'],
    ];

    const getButtonStatusClass = (letter) => {
        const lowerLetter = letter.toLowerCase();
        if (greens.includes(lowerLetter)) return 'key-status-green';
        if (yellows.some(set => set.has(lowerLetter))) return 'key-status-yellow';
        if (grays.has(lowerLetter)) return 'key-status-gray';
        return 'key-status-default';
    };

    return (
        <div className="keyboard-container">
            {keyboardRows.map((row, rowIndex) => (
                <div key={rowIndex} className="keyboard-row">
                    {row.map((key) => (
                        <button
                            key={key}
                            onClick={() => onKeyPress(key)}
                            className={`keyboard-button ${key.length > 1 ? 'keyboard-button-wide' : ''} ${getButtonStatusClass(key)}`}
                        >
                            {key}
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default Keyboard;
