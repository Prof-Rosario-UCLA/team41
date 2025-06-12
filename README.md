# Customizyrdle — Team 41

A customizable Wordle-style game.

## Local Setup

1. Start MongoDB:
   mongod --dbpath path/to/your/data

2. Backend:
   cd server
   npm install
   node populateJS        # or: node populateDbLight for smaller word set
   npm run dev

3. Frontend:
   cd ../client
   npm install
   npm run dev

##  APIs

We include example inputs as well

### POST /chooseWord

Selects a new target word based on game settings and restrictions.

Input:
{
  "wordLength": 5, Number of letters in the word
  "numGuesses": 6, Allowed number of guesses
  "gameType": "normal", "normal" or "hard" mode
  "letterRestrictions": "", Letters that must NOT appear
  "letterGuarantees": "", Letters that MUST appear
  "specificRestrictions": "", Pattern, e.g. "A_PLE"
  "db": 1, Database number (always 1 for now)
  "theme": "", Optional theme filter
  "repeatsAllowed": Allow repeated words from the same session 
  "previousWords": Words already used (to avoid repeats)
}

Output:
{
  "targetWord": "crane",         // Selected target word
  "queryStatus": "NO_WORDS_FOUND"            // VALID, or error type
}

### POST /checkWordExists

Validates if a guess exists in the word list.

Input:
{
  "word": Word to check
  "wordLength": To find the DB to match against
  "db": Always 1 for now
}

Output:
{
  "success":  Bool, if request successful (no error)
  "contained": Bool, if word exists in the list
  "status": VALID, or Error messages
}

## Notes

- Use `populateDbLight` to seed a smaller word list for faster testing.
- Backend and frontend both use `npm run dev` to launch.
