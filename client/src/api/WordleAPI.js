const API_BASE_URL = '/api'; 

export const chooseWord = async (params) => {
    console.log("chooseWord params:", params);
    const response = await fetch(`${API_BASE_URL}/words/choose-word`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    // Check if response is OK (2xx status)
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to choose word');
    }
    return response.json();
};


export const checkWordExists = async (word, wordLength, db) => {
    console.log("checkWordExists:", word, wordLength, db);
    const response = await fetch(`${API_BASE_URL}/words/check-word-exists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, wordLength, db }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check word existence');
    }
    
    return response.json();
};
