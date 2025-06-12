import { useContext } from 'react';
import { GameContext } from '../context/Game'; 

export const useGame = () => {
    // Consume the WordleContext 
    const context = useContext(GameContext);

    // Throw an error if the hook is used outside of a WordleProvider
    if (context === undefined) {
        throw new Error('useGame must be used within a GameProvider');
    }

    return context;
};