'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Lexicon, tokenize } = require('../lexicon.js');

const TEXT = `The cat sat on the mat. A dog sat on a rug. The dog ran to the park. A cat ran to the house.
The bird sang in the tree. A bird flew over the house. We walked to the river. They walked to the station.
I like the cat. You like the dog. She likes the garden. He likes the river. Mira walked home with Tomas.
We played in the park. They jumped over the rug. I walked and played and jumped.`;

function trained() {
  const lex = new Lexicon();
  lex.learn(TEXT, 1000);
  return lex;
}

test('tokenize splits sentences and normalizes words', () => {
  const s = tokenize('Hello, World! It’s fine.\nNew line here');
  assert.deepEqual(s.map((x) => x.words), [['hello', 'world'], ["it's", 'fine'], ['new', 'line', 'here']]);
  assert.deepEqual(tokenize('Ça va? Привет мир.').map((x) => x.words), [['ça', 'va'], ['привет', 'мир']]);
});

test('learn reports only never-seen words', () => {
  const lex = new Lexicon();
  assert.deepEqual(lex.learn('the cat sat').newWords, ['the', 'cat', 'sat']);
  assert.deepEqual(lex.learn('the dog sat').newWords, ['dog']);
  assert.equal(lex.words.get('the').count, 2);
  assert.equal(lex.totalTokens, 6);
  assert.equal(lex.totalSentences, 2);
});

test('predict completes prefixes and guesses the next word', () => {
  const lex = trained();
  const next = lex.predict(['the'], '').map((s) => s.word);
  assert.ok(next.includes('cat') && next.includes('dog'), next.join());
  const done = lex.predict([], 'wa').map((s) => s.word);
  assert.deepEqual(done, ['walked']);
  assert.ok(!lex.predict([], 'cat').some((s) => s.word === 'cat'), 'does not suggest the word already typed');
});

test('analyze discovers word classes from context', () => {
  const a = trained().analyze();
  assert.ok(a.classes.length >= 2);
  const same = (x, y) => a.classOf.has(x) && a.classOf.get(x) === a.classOf.get(y);
  assert.ok(same('cat', 'dog'), 'cat and dog share a class');
  assert.ok(same('the', 'a'), 'the and a share a class');
  assert.ok(!same('the', 'cat'));
});

test('analyze finds repeated sentence patterns', () => {
  const a = trained().analyze();
  const top = a.patterns[0];
  assert.ok(top.count >= 2);
  assert.ok(top.examples.length >= 2);
});

test('morphology finds suffixes shared by several words', () => {
  const lex = new Lexicon();
  lex.learn('walk walked walking. play played playing. jump jumped. make making. run running.');
  const m = lex.analyze().morphology;
  const affixes = m.rules.map((r) => r.affix);
  assert.ok(affixes.includes('ed'));
  assert.ok(affixes.includes('ing'));
  const ing = m.rules.find((r) => r.affix === 'ing').examples.map((e) => e.join('>'));
  assert.ok(ing.includes('make>making') && ing.includes('run>running'), ing.join());
  assert.deepEqual(m.familyOf.get('walked').forms, ['walk', 'walked', 'walking']);
});

test('describe flags names and reports neighbours', () => {
  const lex = trained();
  assert.equal(lex.describe('tomas').nameLike, true);
  assert.equal(lex.describe('cat').nameLike, false);
  const d = lex.describe('like');
  assert.deepEqual(d.followers[0], ['the', 2]);
  assert.equal(lex.describe('nope'), null);
});

test('generate only produces learned transitions', () => {
  const lex = trained();
  let seed = 1;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 20; i++) {
    const s = lex.generate(15, rng);
    assert.ok(s.length > 0);
    s.forEach((w) => assert.ok(lex.words.has(w)));
    for (let j = 0; j < s.length - 1; j++) assert.ok(lex.next.get(s[j]).has(s[j + 1]));
  }
});

test('forget removes a word everywhere', () => {
  const lex = trained();
  const before = lex.totalTokens;
  const n = lex.words.get('cat').count;
  assert.ok(lex.forget('Cat'));
  assert.ok(!lex.has('cat'));
  assert.equal(lex.totalTokens, before - n);
  lex.next.forEach((m) => assert.ok(!m.has('cat')));
  lex.next2.forEach((m, k) => { assert.ok(!k.split('\u0001').includes('cat')); assert.ok(!m.has('cat')); });
  assert.ok(lex.sentences.every((s) => !s.includes('cat')));
  assert.equal(lex.forget('cat'), false);
});

test('toJSON / fromJSON round-trips', () => {
  const lex = trained();
  const copy = Lexicon.fromJSON(JSON.parse(JSON.stringify(lex.toJSON())));
  assert.equal(copy.size(), lex.size());
  assert.equal(copy.totalTokens, lex.totalTokens);
  assert.deepEqual(copy.predict(['the'], ''), lex.predict(['the'], ''));
  assert.deepEqual(copy.analyze().patterns, lex.analyze().patterns);
  assert.throws(() => Lexicon.fromJSON({}), /Not a WordWeave file/);
});
