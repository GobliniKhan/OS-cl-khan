# WordWeave

A small app that learns a language from what you type. It starts with no dictionary or grammar.
Every word you type adds to its vocabulary, and as you keep typing it works out a structure for the language:

| What it learns | How |
|---|---|
| **Vocabulary** | Each finished word is checked as you type and marked **new** the first time it appears. Tracks counts, when the word was first learned, and whether it looks like a name (capitalised mid-sentence). |
| **Word order** | Bigram and trigram counts (which word follows which). These drive live autocomplete and next-word suggestions (<kbd>Tab</kbd> to accept), plus **Babble**, which makes up new sentences. |
| **Word classes** | Words that appear in similar surroundings are clustered into classes (`C1`, `C2`, …). It clusters repeatedly, replacing neighbours with their classes each time, so *the cat* and *a dog* end up grouped once *the* and *a* are. Roughly, these are parts of speech it has worked out for itself. |
| **Class grammar** | For each class, which classes usually come before and after it (e.g. `C1 → C3 93%`). |
| **Sentence patterns** | Every sentence rewritten as a class sequence (`C1 C3 C4 C1 C2`). Repeated sequences are the grammar it has inferred. |
| **Word forms** | Suffixes and prefixes that turn one known word into another (`walk → walked`, `play → played` gives `-ed`), including dropped *e* (*make → making*) and doubled consonants (*run → running*). A rule only counts once it works for two different words. Related words are grouped into families. |

Words are split using Unicode letter rules, so it works for any language that separates words with spaces.

## Run it

Open `index.html` in a browser. There is no build step and no server, and it has no dependencies.

```bash
xdg-open wordweave/index.html     # Linux
open wordweave/index.html         # macOS
```

- Type in the box. Finished words show up above it, highlighted while they are still new. A sentence
  is learned when it ends with `.` `!` `?` or when you press <kbd>Enter</kbd>.
- Click any word, in the transcript, the lists or on the map, to see what has been learned about it:
  its class, the words around it, words used the same way, and its word family. Use **Forget** to remove typos.
- **Map** draws the most-used words with arrows to the words that follow them, coloured by class.
- Everything is saved in the browser's `localStorage`. **Export** and **Import** move a learned language
  between browsers as JSON.

## Files

- `lexicon.js`: the learning engine (no DOM). Runs in the browser and in Node.
- `app.js`, `index.html`, `style.css`: the interface.
- `test/`: engine tests.

```bash
cd wordweave && node --test      # Node 18+
```

### Using the engine directly

```js
const { Lexicon } = require('./wordweave/lexicon.js');
const lex = new Lexicon();
lex.learn('The cat sat on the mat. A dog sat on a rug.');   // -> { newWords: [...], sentences: 2, tokens: 12 }
lex.predict(['the'], '');        // next-word guesses
lex.predict([], 'ca');           // completions
lex.analyze();                   // { classes, patterns, morphology, classGrammar, ... }
lex.describe('cat');             // everything known about one word
lex.generate();                  // a made-up sentence
```
