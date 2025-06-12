import { useContext } from 'react';
import { WordleContext } from '../context/Wordle'; 

export const useWordle = () => {
    const context = useContext(WordleContext);

    if (context === undefined) {
        throw new Error('useWordle must be used within a WordleProvider');
    }

    return context;
};
