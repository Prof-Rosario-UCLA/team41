import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
// import { getAuth } from "firebase/auth"; 
import {
    openAppDB, saveGame, loadGame, clearGame, getActiveGameId,
} from '../utils/IndexedDB';

// Create generic GameContext
export const GameContext = createContext();

export const GameProvider = ({ children }) => {
    const [isDbReady, setIsDbReady] = useState(false); 
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [userId, setUserId] = useState(null); 

    // TODO: Change this when implementing authentication
    const auth = null;

    // Initialize IndexedDB and listen for auth changes
    useEffect(() => {
        const initializeDbAndAuth = async () => {
            try {
                // Initialize IndexedDB
                await openAppDB();
                setIsDbReady(true);
                console.log("IndexedDB for app opened.");

                // Listen for authentication state changes to get the userId
                /*
                const unsubscribe = auth.onAuthStateChanged(user => {
                    if (user) {
                        setUserId(user.uid);
                    } else {
                        // TODO: I don't know that I want this to be the permanent solution
                        // Can we just have userID be null in this case?
                        // Probably depends on Auth, which is yet to be implemented
                        setUserId(crypto.randomUUID()); 
                    }
                });
                return () => unsubscribe(); 
                */
            } catch (error) {
                console.error("Failed to initialize IndexedDB:", error);
                setIsDbReady(false);
            }
                
        };

        initializeDbAndAuth();

        // Listen for online/offline events
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [auth]); 


    // Expose generic IndexedDB functions and network status
    const contextValue = {
        isDbReady,
        isOffline,
        userId, 
        // Generic IndexedDB functions
        saveGame: useCallback(async (gameData) => {
            if (!isDbReady || !userId) {
                console.warn("IndexedDB not ready or userId not available. Cannot save game.");
                return;
            }
            // Pass userId to IndexedDB function for proper scoping
            await saveGame(userId, gameData);
        }, [isDbReady, userId]),

        loadGame: useCallback(async (gameId) => {
            if (!isDbReady || !userId) {
                console.warn("IndexedDB not ready or userId not available. Cannot load game.");
                return null;
            }

            return await loadGame(userId, gameId);
        }, [isDbReady, userId]),

        clearGame: useCallback(async (gameId) => {
            if (!isDbReady || !userId) {
                console.warn("IndexedDB not ready or userId not available. Cannot clear game.");
                return;
            }
        
            await clearGame(userId, gameId);
        }, [isDbReady, userId]),

        getActiveGameId: useCallback(async () => {
            if (!isDbReady || !userId) {
                console.warn("IndexedDB not ready or userId not available. Cannot get active game ID.");
                return null;
            }
 
            return await getActiveGameId(userId);
        }, [isDbReady, userId]),
    };

    return (
        <GameContext.Provider value={contextValue}>
            {children}
        </GameContext.Provider>
    );
};
