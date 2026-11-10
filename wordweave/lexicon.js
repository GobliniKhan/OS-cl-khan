/*
 * WordWeave lexicon engine.
 *
 * Learns a language from the text it is fed, with no built-in dictionary or grammar:
 *   - vocabulary: every word, how often it is used, when it was first seen, whether it looks like a name
 *   - sequence model: which word follows which (bigrams) and which follows a pair (trigrams)
 *   - word classes: words grouped by the company they keep (distributional clustering)
 *   - class grammar: which class tends to follow which
 *   - sentence patterns: sentences rewritten as class sequences
 *   - morphology: suffixes and prefixes that turn one known word into another
 *
 * Plain JavaScript, no dependencies. Loaded by index.html as a classic script (window.WordWeave)
 * and by Node for the tests (module.exports).
 */
(function (global) {
  'use strict';

  var WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
  var SENTENCE_SPLIT = /(?<=[.!?…])["')\]”’]*\s+|\n+/;
  var START = '<s>';
  var END = '</s>';
  var SEP = '\u0001';
  var MAX_SENTENCES = 5000;
  var MAX_CLUSTER_WORDS = 400;
  var CLUSTER_THRESHOLD = 0.5;
  var CLUSTER_ROUNDS = 3;

  function normalize(word) {
    return word.replace(/’/g, "'").toLocaleLowerCase();
  }

  function isBoundary(w) {
    return w === START || w === END;
  }

  /** Split text into sentences of words. Returns [{words: [normalized], raw: [as typed]}]. */
  function tokenize(text) {
    var out = [];
    String(text || '').split(SENTENCE_SPLIT).forEach(function (chunk) {
      var raw = chunk.match(WORD_RE);
      if (raw && raw.length) out.push({ words: raw.map(normalize), raw: raw });
    });
    return out;
  }

  function inc(map, key, by) {
    map.set(key, (map.get(key) || 0) + (by || 1));
  }

  function bump(nested, a, b, by) {
    var m = nested.get(a);
    if (!m) {
      m = new Map();
      nested.set(a, m);
    }
    inc(m, b, by);
  }

  function total(map) {
    var t = 0;
    map.forEach(function (v) { t += v; });
    return t;
  }

  function topN(map, n, skip) {
    var arr = [];
    map.forEach(function (v, k) { if (!skip || !skip(k)) arr.push([k, v]); });
    arr.sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); });
    return arr.slice(0, n);
  }

  // ---- sparse vectors -------------------------------------------------------------------------

  function normalizeVec(v) {
    var s = 0;
    v.forEach(function (x) { s += x * x; });
    s = Math.sqrt(s) || 1;
    var out = new Map();
    v.forEach(function (x, k) { out.set(k, x / s); });
    return out;
  }

  function dot(a, b) {
    if (a.size > b.size) { var t = a; a = b; b = t; }
    var s = 0;
    a.forEach(function (x, k) { var y = b.get(k); if (y) s += x * y; });
    return s;
  }

  function addInto(sum, v) {
    v.forEach(function (x, k) { sum.set(k, (sum.get(k) || 0) + x); });
  }

  function norm(v) {
    var s = 0;
    v.forEach(function (x) { s += x * x; });
    return Math.sqrt(s);
  }

  // ---- Lexicon --------------------------------------------------------------------------------

  function Lexicon() {
    this.reset();
  }

  Lexicon.prototype.reset = function () {
    this.words = new Map();     // word -> {count, caps, first, last}
    this.next = new Map();      // word -> Map(next word -> count); includes <s> and </s>
    this.next2 = new Map();     // "a SEP b" -> Map(next word -> count)
    this.sentences = [];        // most recent sentences, as word arrays (for patterns)
    this.totalTokens = 0;
    this.totalSentences = 0;
    this._analysis = null;
  };

  Lexicon.prototype.has = function (word) {
    return this.words.has(normalize(word));
  };

  Lexicon.prototype.size = function () {
    return this.words.size;
  };

  /**
   * Learn from text. Returns {newWords, sentences, tokens}: newWords lists words never seen before,
   * in the order they appeared.
   */
  Lexicon.prototype.learn = function (text, now) {
    now = now || Date.now();
    var self = this;
    var sents = tokenize(text);
    var newWords = [];
    var tokens = 0;
    sents.forEach(function (s) {
      var ws = s.words;
      ws.forEach(function (w, i) {
        var e = self.words.get(w);
        if (!e) {
          e = { count: 0, caps: 0, first: now, last: now };
          self.words.set(w, e);
          newWords.push(w);
        }
        e.count++;
        e.last = now;
        // Capitalized somewhere other than the start of a sentence: a hint that it is a name.
        if (i > 0 && /^\p{Lu}/u.test(s.raw[i])) e.caps++;
      });
      var seq = [START].concat(ws, [END]);
      for (var i = 0; i < seq.length - 1; i++) bump(self.next, seq[i], seq[i + 1]);
      var seq2 = [START].concat(seq);
      for (var j = 0; j < seq2.length - 2; j++) bump(self.next2, seq2[j] + SEP + seq2[j + 1], seq2[j + 2]);
      self.sentences.push(ws);
      self.totalTokens += ws.length;
      self.totalSentences++;
      tokens += ws.length;
    });
    if (this.sentences.length > MAX_SENTENCES) this.sentences.splice(0, this.sentences.length - MAX_SENTENCES);
    if (sents.length) this._analysis = null;
    return { newWords: newWords, sentences: sents.length, tokens: tokens };
  };

  /** Remove a word (e.g. a typo) and everything learned about it. */
  Lexicon.prototype.forget = function (word) {
    word = normalize(word);
    var e = this.words.get(word);
    if (!e) return false;
    this.words.delete(word);
    this.totalTokens -= e.count;
    this.next.delete(word);
    this.next.forEach(function (m, k, outer) {
      m.delete(word);
      if (!m.size) outer.delete(k);
    });
    var self = this;
    Array.from(this.next2.keys()).forEach(function (key) {
      var parts = key.split(SEP);
      if (parts[0] === word || parts[1] === word) { self.next2.delete(key); return; }
      var m = self.next2.get(key);
      m.delete(word);
      if (!m.size) self.next2.delete(key);
    });
    this.sentences = this.sentences
      .map(function (s) { return s.filter(function (w) { return w !== word; }); })
      .filter(function (s) { return s.length; });
    this._analysis = null;
    return true;
  };

  /**
   * Suggest words. context: the words already typed in this sentence; prefix: the partial word being
   * typed ('' for next-word prediction). Uses trigram -> bigram -> unigram backoff.
   * Returns [{word, score, source}].
   */
  Lexicon.prototype.predict = function (context, prefix, k) {
    k = k || 5;
    prefix = prefix ? normalize(prefix) : '';
    var ctx = [START, START].concat((context || []).map(normalize)).slice(-2);
    var scores = new Map();
    function consider(m, weight, source) {
      if (!m) return;
      var t = total(m);
      m.forEach(function (n, w) {
        if (isBoundary(w)) return;
        if (prefix && (w === prefix || w.indexOf(prefix) !== 0)) return;
        var s = weight * n / t;
        var cur = scores.get(w);
        if (!cur || s > cur.score) scores.set(w, { word: w, score: s, source: source });
      });
    }
    consider(this.next2.get(ctx[0] + SEP + ctx[1]), 1, 'trigram');
    consider(this.next.get(ctx[1]), 0.4, 'bigram');
    if (prefix || scores.size < k) {
      var uni = new Map();
      this.words.forEach(function (e, w) { uni.set(w, e.count); });
      consider(uni, prefix ? 0.16 : 0.05, 'unigram');
    }
    return Array.from(scores.values())
      .sort(function (a, b) { return b.score - a.score || (a.word < b.word ? -1 : 1); })
      .slice(0, k);
  };

  /** Make up a sentence from what has been learned. rng: optional () => [0,1). */
  Lexicon.prototype.generate = function (maxLen, rng) {
    maxLen = maxLen || 25;
    rng = rng || Math.random;
    var out = [];
    var a = START, b = START;
    while (out.length < maxLen) {
      var m = this.next2.get(a + SEP + b);
      if (!m || (m.size === 1 && rng() < 0.15)) m = this.next.get(b) || m;
      if (!m) break;
      var r = rng() * total(m), w = END;
      for (var entry of m) {
        r -= entry[1];
        if (r <= 0) { w = entry[0]; break; }
      }
      if (w === END) break;
      out.push(w);
      a = b;
      b = w;
    }
    return out;
  };

  Lexicon.prototype.followers = function (word, n) {
    var m = this.next.get(normalize(word));
    return m ? topN(m, n || 8, isBoundary) : [];
  };

  Lexicon.prototype.predecessors = function (word, n) {
    word = normalize(word);
    var m = new Map();
    this.next.forEach(function (nm, a) {
      var c = nm.get(word);
      if (c && !isBoundary(a)) m.set(a, c);
    });
    return topN(m, n || 8);
  };

  /** How often a word opens / closes a sentence. */
  Lexicon.prototype.positions = function (word) {
    word = normalize(word);
    var s = this.next.get(START);
    var e = this.next.get(word);
    return { starts: (s && s.get(word)) || 0, ends: (e && e.get(END)) || 0 };
  };

  // ---- structure analysis ---------------------------------------------------------------------

  /** Context vectors: for each word, which words (or classes) appear just before and after it. */
  Lexicon.prototype._contextVectors = function (label) {
    var vecs = new Map();
    function lab(w) { return isBoundary(w) ? w : (label.get(w) || w); }
    function add(w, f, n) {
      var v = vecs.get(w);
      if (!v) { v = new Map(); vecs.set(w, v); }
      v.set(f, (v.get(f) || 0) + Math.sqrt(n));
    }
    this.next.forEach(function (m, a) {
      m.forEach(function (n, b) {
        if (!isBoundary(b)) add(b, 'L:' + lab(a), n);
        if (!isBoundary(a)) add(a, 'R:' + lab(b), n);
      });
    });
    vecs.forEach(function (v, w) { vecs.set(w, normalizeVec(v)); });
    return vecs;
  };

  function leaderCluster(order, vecs, threshold) {
    var clusters = []; // {members: [], sum: Map}
    order.forEach(function (w) {
      var v = vecs.get(w);
      if (!v) return;
      var best = null, bestSim = threshold;
      clusters.forEach(function (c) {
        var sim = dot(v, c.sum) / (norm(c.sum) || 1);
        if (sim > bestSim) { bestSim = sim; best = c; }
      });
      if (best) {
        best.members.push(w);
        addInto(best.sum, v);
      } else {
        var sum = new Map();
        addInto(sum, v);
        clusters.push({ members: [w], sum: sum });
      }
    });
    return clusters.filter(function (c) { return c.members.length > 1; });
  }

  function morphology(words) {
    var suffixPairs = new Map(); // suffix -> [[base, form]]
    var prefixPairs = new Map();
    function push(map, affix, base, form) {
      if (base === form) return;
      var arr = map.get(affix);
      if (!arr) { arr = []; map.set(affix, arr); }
      arr.push([base, form]);
    }
    words.forEach(function (e, w) {
      if (/\d/.test(w)) return;
      for (var k = 1; k <= 4 && w.length - k >= 3; k++) {
        var stem = w.slice(0, -k), suf = w.slice(-k);
        if (words.has(stem)) push(suffixPairs, suf, stem, w);
        else if (/^[aeiouy]/.test(suf) && words.has(stem + 'e')) push(suffixPairs, suf, stem + 'e', w);
        else if (/^[aeiouy]/.test(suf) && /([^aeiou])\1$/.test(stem) && words.has(stem.slice(0, -1))) {
          push(suffixPairs, suf, stem.slice(0, -1), w);
        }
      }
      for (var p = 2; p <= 4 && w.length - p >= 3; p++) {
        if (words.has(w.slice(p))) push(prefixPairs, w.slice(0, p), w.slice(p), w);
      }
    });
    var rules = [];
    var families = new Map();
    function collect(map, kind) {
      map.forEach(function (pairs, affix) {
        var bases = new Set(pairs.map(function (p) { return p[0]; }));
        if (bases.size < 2) return; // one example is a coincidence, two is a pattern
        rules.push({ kind: kind, affix: affix, examples: pairs });
        pairs.forEach(function (p) {
          var f = families.get(p[0]);
          if (!f) { f = new Set([p[0]]); families.set(p[0], f); }
          f.add(p[1]);
        });
      });
    }
    collect(suffixPairs, 'suffix');
    collect(prefixPairs, 'prefix');
    rules.sort(function (a, b) { return b.examples.length - a.examples.length || (a.affix < b.affix ? -1 : 1); });
    var familyList = [];
    families.forEach(function (forms, base) {
      familyList.push({ base: base, forms: Array.from(forms).sort() });
    });
    familyList.sort(function (a, b) { return b.forms.length - a.forms.length || (a.base < b.base ? -1 : 1); });
    var familyOf = new Map();
    familyList.forEach(function (f) {
      f.forms.forEach(function (w) { if (!familyOf.has(w)) familyOf.set(w, f); });
    });
    return { rules: rules, families: familyList, familyOf: familyOf };
  }

  /**
   * Build the language structure: word classes, class grammar, sentence patterns, morphology.
   * Cached until the next learn()/forget().
   */
  Lexicon.prototype.analyze = function () {
    if (this._analysis) return this._analysis;
    var self = this;
    var minCount = this.totalTokens < 300 ? 1 : 2;
    var order = Array.from(this.words.entries())
      .filter(function (e) { return e[1].count >= minCount; })
      .sort(function (a, b) { return b[1].count - a[1].count || (a[0] < b[0] ? -1 : 1); })
      .slice(0, MAX_CLUSTER_WORDS)
      .map(function (e) { return e[0]; });

    // Iterate: cluster on raw neighbours, then re-cluster with neighbours replaced by their class,
    // so "the cat" and "a dog" end up sharing features once "the" and "a" share a class.
    var label = new Map();
    var vecs, clusters = [];
    for (var round = 0; round < CLUSTER_ROUNDS; round++) {
      vecs = this._contextVectors(label);
      clusters = leaderCluster(order, vecs, CLUSTER_THRESHOLD);
      label = new Map();
      clusters.forEach(function (c, i) {
        c.members.forEach(function (w) { label.set(w, '#' + i); });
      });
    }

    var classes = clusters.map(function (c) {
      var count = 0;
      c.members.sort(function (a, b) { return self.words.get(b).count - self.words.get(a).count || (a < b ? -1 : 1); });
      c.members.forEach(function (w) { count += self.words.get(w).count; });
      return { members: c.members, count: count };
    }).sort(function (a, b) { return b.count - a.count; });

    var classOf = new Map();
    classes.forEach(function (c, i) {
      c.id = i;
      c.name = 'C' + (i + 1);
      c.label = c.members.slice(0, 3).join(' · ');
      c.members.forEach(function (w) { classOf.set(w, i); });
    });

    function tag(w) {
      if (w === START) return '^';
      if (w === END) return '$';
      return classOf.has(w) ? 'C' + (classOf.get(w) + 1) : '*';
    }

    // Class grammar: which class follows which.
    var classNext = new Map();
    this.next.forEach(function (m, a) {
      m.forEach(function (n, b) { bump(classNext, tag(a), tag(b), n); });
    });
    classes.forEach(function (c) {
      var after = classNext.get(c.name) || new Map();
      var t = total(after) || 1;
      c.followedBy = topN(after, 4).map(function (e) { return { tag: e[0], share: e[1] / t }; });
      var before = new Map();
      classNext.forEach(function (m, a) { var n = m.get(c.name); if (n) before.set(a, n); });
      var tb = total(before) || 1;
      c.precededBy = topN(before, 4).map(function (e) { return { tag: e[0], share: e[1] / tb }; });
    });

    // Sentence patterns.
    var patterns = new Map();
    this.sentences.forEach(function (s) {
      if (s.length < 2 || s.length > 14) return;
      var key = s.map(tag).join(' ');
      var p = patterns.get(key);
      if (!p) { p = { pattern: key, count: 0, examples: [] }; patterns.set(key, p); }
      p.count++;
      var ex = s.join(' ');
      if (p.examples.length < 3 && p.examples.indexOf(ex) < 0) p.examples.push(ex);
    });
    var patternList = Array.from(patterns.values())
      .filter(function (p) { return p.pattern.indexOf('C') >= 0; })
      .sort(function (a, b) { return b.count - a.count || a.pattern.length - b.pattern.length; });

    this._analysis = {
      classes: classes,
      classOf: classOf,
      vectors: vecs,
      classGrammar: classNext,
      patterns: patternList,
      morphology: morphology(this.words),
      tag: tag
    };
    return this._analysis;
  };

  /** Words used in the most similar contexts to the given word. */
  Lexicon.prototype.similar = function (word, k) {
    word = normalize(word);
    var vecs = this.analyze().vectors || new Map();
    var v = vecs.get(word);
    if (!v) return [];
    var out = [];
    vecs.forEach(function (u, w) {
      if (w === word) return;
      var s = dot(u, v);
      if (s > 0.05) out.push([w, s]);
    });
    out.sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); });
    return out.slice(0, k || 6);
  };

  /** Everything known about one word. */
  Lexicon.prototype.describe = function (word) {
    word = normalize(word);
    var e = this.words.get(word);
    if (!e) return null;
    var a = this.analyze();
    var cid = a.classOf.has(word) ? a.classOf.get(word) : null;
    var fam = a.morphology.familyOf.get(word);
    var pos = this.positions(word);
    return {
      word: word,
      count: e.count,
      first: e.first,
      last: e.last,
      nameLike: e.count > 0 && e.caps / e.count >= 0.6,
      frequency: this.totalTokens ? e.count / this.totalTokens : 0,
      class: cid === null ? null : a.classes[cid],
      followers: this.followers(word),
      predecessors: this.predecessors(word),
      similar: this.similar(word),
      family: fam ? fam.forms : null,
      starts: pos.starts,
      ends: pos.ends
    };
  };

  // ---- persistence ----------------------------------------------------------------------------

  function nestedToJSON(nested) {
    var out = [];
    nested.forEach(function (m, k) { out.push([k, Array.from(m.entries())]); });
    return out;
  }

  function nestedFromJSON(arr) {
    var out = new Map();
    (arr || []).forEach(function (e) { out.set(e[0], new Map(e[1])); });
    return out;
  }

  Lexicon.prototype.toJSON = function () {
    return {
      format: 'wordweave',
      version: 1,
      words: Array.from(this.words.entries()),
      next: nestedToJSON(this.next),
      next2: nestedToJSON(this.next2),
      sentences: this.sentences,
      totalTokens: this.totalTokens,
      totalSentences: this.totalSentences
    };
  };

  Lexicon.fromJSON = function (data) {
    if (!data || data.format !== 'wordweave') throw new Error('Not a WordWeave file');
    var lex = new Lexicon();
    lex.words = new Map(data.words);
    lex.next = nestedFromJSON(data.next);
    lex.next2 = nestedFromJSON(data.next2);
    lex.sentences = data.sentences || [];
    lex.totalTokens = data.totalTokens || 0;
    lex.totalSentences = data.totalSentences || 0;
    return lex;
  };

  var api = {
    Lexicon: Lexicon,
    tokenize: tokenize,
    normalize: normalize,
    WORD_RE: WORD_RE,
    START: START,
    END: END
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.WordWeave = api;
})(typeof window !== 'undefined' ? window : this);
