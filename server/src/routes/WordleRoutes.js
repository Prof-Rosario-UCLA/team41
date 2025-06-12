import express from 'express';
const router = express.Router();
import  { chooseWordController, checkWordExistsController }  from '../controllers/WordleControllers.js';

// Route to choose a new word based on parameters
router.post('/choose-word', chooseWordController);
// Route to check if a word exists in the dictionary 
router.post('/check-word-exists', checkWordExistsController);

export default router;