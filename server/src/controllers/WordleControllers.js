
import { chooseWord, isContained } from '../core/Wordle.js'; 
import { QueryStatus, ContainedStatus } from '../Enums.js'; 

// TODO: This will be done differently
export const chooseWordController = async (req, res) => {
    const body = req.body;
    const { wordLength, numGuesses, gameType, letterRestrict, letterGuarantee, specificRestrict, db, theme, prevWords, repeats  } = body;
    
    console.log("  Raw req.body:", req.body);

    console.log("Controller Destructured Variables:");
    console.log("wordLength:", wordLength);
    console.log("numGuesses:", numGuesses);
    console.log("gameType:", gameType);
    console.log("letterRestrict:", letterRestrict);
    console.log("letterGuarantee:", letterGuarantee);
    console.log("specificRestrict:", specificRestrict);
    console.log("db:", db);
    console.log("theme:", theme);
    console.log("repeats:", repeats);
    console.log("prevWords:", prevWords);

    try {
        // Call the core game logic function
        const result = await chooseWord(
            wordLength, letterRestrict, letterGuarantee, specificRestrict, db, theme, prevWords, repeats
        );

        console.log("chooseWordController result: ", result);
        res.json({ status: result.status, target: result.target });
    
    } catch (error) {
        console.error('Error in chooseWord controller:', error);
        res.status(500).json({ status: false, message: 'Server error choosing word.' });
    }
};

export const checkWordExistsController = async (req, res) => {
    const { word, wordLength, db } = req.body;
    try {
        console.log("params:");
        console.log("word", word);
        console.log("wordLength: ", wordLength);
        console.log("db: ", db);
        const { exists, status } = await isContained(word, wordLength, db);

        if (status === ContainedStatus.VALID) {
            res.json({ success: exists, status: status});
        } else {
            res.status(500).json({ success: false, status: status, message: `Database query failed: ${status}` });
        }
    } catch (error) {

        console.error('Error in checkWordExists controller:', error);
        res.status(500).json({ success: false, status: status, message: 'Server error checking word existence.' });
    }
};