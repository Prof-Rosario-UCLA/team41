import React from 'react';
import { LetterResult } from '../Enums';
import './Grid.css'; 

const Grid = ({ board, currentGuessIndex, wordLength, numGuesses }) => {
    const getCellStatusClass = (status) => {
        switch (status) {
            case LetterResult.GREEN: return 'cell-status-correct';
            case LetterResult.YELLOW: return 'cell-status-present';
            case LetterResult.GRAY: return 'cell-status-absent';
            case LetterResult.WHITE: return 'cell-status-empty';
            default: return 'cell-status-empty';
        }
    };

    return (
        <div className="grid-container">
            <div className="grid-rows-wrapper">
                {board.map((row, rowIndex) => (
                    <div key={rowIndex} className="grid-row">
                        {row.map((cell, cellIndex) => (
                            <div
                                key={cellIndex}
                                className={`
                                    grid-cell
                                    ${getCellStatusClass(cell?.status || 'empty')}
                                    ${rowIndex === currentGuessIndex && cell.letter === '' ? 'current-active-cell' : ''}
                                    ${cell.letter !== '' ? 'filled-cell' : ''}
                                `}
                            >
                                {cell.letter ? cell.letter.toUpperCase() : ''}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            <p className="grid-info-text">
                Word Length: {wordLength || 'N/A'}, Guesses: {numGuesses || 'N/A'}
            </p>
        </div>
    );
};

export default Grid;