/* WordWeave UI. Depends on lexicon.js (window.WordWeave). */
(function () {
  'use strict';

  var WW = window.WordWeave;
  var STORAGE_KEY = 'wordweave:v1';
  var MAX_HISTORY = 300;
  var WORD_RE = WW.WORD_RE;
  var SENTENCE_CUT = /[.!?…]["')\]”’]*\s+/g;
  var SAMPLE = [
    'The cat sat on the warm mat.',
    'A dog slept on a soft rug.',
    'The dog ran to the park.',
    'A small bird sang in the old tree.',
    'My sister walked to the market.',
    'We walked to the river and the children were playing.',
    'The cat is sleeping and the dog is barking.',
    'I like the river.',
    'You like the park.',
    'She likes the garden and he likes the market.',
    'Mira walked home with Tomas.',
    'The young girl ran quickly and the old man walked slowly.',
    'A big dog barked loudly.',
    'The bird is singing.',
    'They are walking to the garden.',
    'I walk to the park and she walks to the river.',
    'The children play in the garden and the dog plays in the park.',
    'We played by the river.'
  ];

  var lex = new WW.Lexicon();
  var history = []; // [{text, fresh: [words learned in this line], generated?: true}]
  var $ = function (id) { return document.getElementById(id); };
  var input = $('input');
  var currentTab = 'map';
  var suggestions = [];

  // ---- helpers --------------------------------------------------------------------------------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function hue(classId) {
    return Math.round((classId * 137.508 + 215) % 360);
  }

  function wordSpan(word, extraClass) {
    var a = lex.analyze();
    var key = WW.normalize(word);
    var cid = a.classOf.get(key);
    var style = cid === undefined ? '' : ' style="--h:' + hue(cid) + '"';
    var cls = 'w' + (cid === undefined ? ' unclassed' : '') + (extraClass ? ' ' + extraClass : '');
    return '<span class="' + cls + '" data-word="' + esc(key) + '"' + style + '>' + esc(word) + '</span>';
  }

  function chip(word, note) {
    var a = lex.analyze();
    var cid = a.classOf.get(word);
    var style = cid === undefined ? '' : ' style="--h:' + hue(cid) + '"';
    return '<span class="chip" data-word="' + esc(word) + '"><span class="w' +
      (cid === undefined ? ' unclassed' : '') + '"' + style + '>' + esc(word) + '</span>' +
      (note !== undefined && note !== '' ? '<small>' + esc(note) + '</small>' : '') + '</span>';
  }

  function tagLabel(tag, a) {
    if (tag === '^') return 'sentence start';
    if (tag === '$') return 'sentence end';
    if (tag === '*') return 'unclassed words';
    var c = a.classes[Number(tag.slice(1)) - 1];
    return c ? tag + ' (' + c.label + ')' : tag;
  }

  function ago(ts) {
    var s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return new Date(ts).toLocaleDateString();
  }

  /** Show a message. A sticky toast stays until the caller removes it (used for progress). */
  function toast(msg, sticky) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    $('toasts').appendChild(el);
    if (!sticky) setTimeout(function () { el.remove(); }, 3200);
    return el;
  }

  function capitalize(s) {
    return s.charAt(0).toLocaleUpperCase() + s.slice(1);
  }

  // ---- persistence ----------------------------------------------------------------------------

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lexicon: lex.toJSON(), history: history }));
    } catch (e) {
      // Storage full or blocked: keep working in memory, and say so once.
      if (!storageWarned) {
        storageWarned = true;
        toast('This browser has no room left to save everything. It will be lost on reload unless you use Export.');
      }
    }
  }
  var storageWarned = false;

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      lex = WW.Lexicon.fromJSON(data.lexicon);
      history = data.history || [];
    } catch (e) { /* corrupt or unavailable: start fresh */ }
  }

  // ---- learning -------------------------------------------------------------------------------

  /** Learn text, one transcript line per sentence. */
  function commit(text, quiet) {
    text = text.trim();
    if (!text) return;
    var classesBefore = lex.analyze().classes.length;
    var learned = [];
    var count = 0;
    // New-word highlights belong to the latest thing taught; older lines go plain.
    history.forEach(function (h) { h.fresh = []; });
    text.split(/(?<=[.!?…]["')\]”’]*)\s+|\n+/).forEach(function (chunk) {
      chunk = chunk.trim();
      if (!chunk) return;
      var res = lex.learn(chunk);
      if (!res.tokens) return;
      count += res.tokens;
      learned = learned.concat(res.newWords);
      history.push({ text: chunk, fresh: res.newWords });
    });
    if (!count) return;
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    save();
    renderAll(true);
    if (quiet) return;
    var classesAfter = lex.analyze().classes.length;
    if (learned.length) {
      var list = learned.slice(0, 6).join(', ') + (learned.length > 6 ? '…' : '');
      toast('Learned ' + learned.length + ' new word' + (learned.length > 1 ? 's' : '') + ': ' + list);
    } else {
      toast('Reinforced ' + count + ' word' + (count > 1 ? 's' : ''));
    }
    if (classesAfter > classesBefore) toast('Discovered a new word class (' + classesAfter + ' now)');
  }

  function babble() {
    var words = lex.generate(20);
    if (!words.length) { toast('Teach me a few sentences first.'); return; }
    history.push({ text: capitalize(words.join(' ')) + '.', fresh: [], generated: true });
    save();
    renderTranscript(true);
  }

  // ---- documents ------------------------------------------------------------------------------

  var DOCS = window.WordWeaveDocs;
  var docQueue = Promise.resolve();

  function learnFiles(files) {
    Array.from(files || []).forEach(function (file) {
      docQueue = docQueue.then(function () { return learnFile(file); });
    });
  }

  function learnFile(file) {
    var status = toast('Reading ' + file.name + '…', true);
    return file.arrayBuffer()
      .then(function (buf) {
        return DOCS.extractText(file.name, new Uint8Array(buf), function (f) {
          status.textContent = 'Reading ' + file.name + '… ' + Math.round(f * 100) + '%';
        });
      })
      .then(function (res) {
        if (!/\p{L}/u.test(res.text)) throw new Error('No words found in it.');
        return learnDocument(file.name, res.text, status);
      })
      .catch(function (err) {
        toast('Couldn’t learn from ' + file.name + ': ' + (err && err.message ? err.message : err));
      })
      .then(function () { status.remove(); });
  }

  /** Learn a whole document in small batches so the page stays responsive. */
  function learnDocument(name, text, status) {
    return new Promise(function (resolve) {
      var parts = text.split(/(?<=[.!?\u2026]["')\]\u201d\u2019]*)\s+|\n+/);
      var classesBefore = lex.analyze().classes.length;
      var newWords = [], tokens = 0, sentences = 0, i = 0;
      function tick() {
        var end = Math.min(parts.length, i + 400);
        var res = lex.learn(parts.slice(i, end).join('\n'));
        newWords = newWords.concat(res.newWords);
        tokens += res.tokens;
        sentences += res.sentences;
        i = end;
        status.textContent = 'Learning ' + name + '… ' + Math.round(i / parts.length * 100) + '% · ' +
          newWords.length + ' new words';
        if (i < parts.length) { setTimeout(tick, 0); return; }
        history.forEach(function (h) { h.fresh = []; });
        var excerpt = text.replace(/\s+/g, ' ').trim();
        history.push({
          doc: { name: name, sentences: sentences, tokens: tokens, newWords: newWords.length },
          text: excerpt.length > 220 ? excerpt.slice(0, 220).replace(/\s\S*$/, '') + '…' : excerpt,
          fresh: newWords.slice(0, 60)
        });
        if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
        save();
        renderAll(true);
        toast('Learned ' + name + ': ' + sentences.toLocaleString() + ' sentences, ' +
          tokens.toLocaleString() + ' words, ' + newWords.length.toLocaleString() + ' new');
        var classesAfter = lex.analyze().classes.length;
        if (classesAfter > classesBefore) toast('Word classes: ' + classesBefore + ' → ' + classesAfter);
        resolve();
      }
      tick();
    });
  }

  // ---- composer -------------------------------------------------------------------------------

  /** Split what is being typed into finished words, the word in progress, and the sentence context. */
  function parseInput() {
    var before = input.value.slice(0, input.selectionEnd);
    var parts = before.split(/[.!?…\n]/);
    var fragment = parts[parts.length - 1];
    var tokens = fragment.match(WORD_RE) || [];
    var typing = /[\p{L}\p{N}'’-]$/u.test(fragment);
    var prefix = typing ? tokens.pop() : '';
    var allDone = (input.value.match(WORD_RE) || []);
    if (/[\p{L}\p{N}'’-]$/u.test(input.value)) allDone = allDone.slice(0, -1);
    return { context: tokens, prefix: prefix, done: allDone };
  }

  function renderLive() {
    var p = parseInput();
    var seen = new Set();
    var html = p.done.map(function (w) {
      var key = WW.normalize(w);
      var isNew = !lex.has(key) && !seen.has(key);
      seen.add(key);
      return '<span class="tok' + (isNew ? ' new' : '') + '">' + esc(w) + '</span>';
    });
    if (p.prefix) html.push('<span class="tok typing">' + esc(p.prefix) + '…</span>');
    $('live').innerHTML = html.join('');
    pendingNew = 0;
    seen.forEach(function (k) { if (!lex.has(k)) pendingNew++; });
    renderStats();

    suggestions = lex.predict(p.context, p.prefix, 6);
    var box = $('suggest');
    if (!suggestions.length) {
      box.innerHTML = lex.size()
        ? '<span class="none">' + (p.prefix ? 'A new word — keep typing and I will learn it.' : 'No guess yet for what comes next.') + '</span>'
        : '';
      return;
    }
    box.innerHTML = suggestions.map(function (s, i) {
      var word = p.prefix && /^\p{Lu}/u.test(p.prefix) ? capitalize(s.word) : s.word;
      return '<button type="button" data-i="' + i + '" title="from ' + s.source + ' model">' +
        esc(word) + (i === 0 ? '<span class="why">tab</span>' : '') + '</button>';
    }).join('');
  }

  function accept(i) {
    var s = suggestions[i];
    if (!s) return;
    var p = parseInput();
    var end = input.selectionEnd;
    var start = end - (p.prefix ? p.prefix.length : 0);
    var word = p.prefix && /^\p{Lu}/u.test(p.prefix) ? capitalize(s.word) : s.word;
    var before = input.value.slice(0, start);
    if (!p.prefix && before && !/\s$/.test(before)) word = ' ' + word;
    input.value = before + word + ' ' + input.value.slice(end);
    var caret = start + word.length + 1;
    input.setSelectionRange(caret, caret);
    input.focus();
    onInput();
  }

  function onInput() {
    var text = input.value;
    var atEnd = input.selectionEnd === text.length;
    if (atEnd) {
      SENTENCE_CUT.lastIndex = 0;
      var cut = -1, m;
      while ((m = SENTENCE_CUT.exec(text))) cut = m.index + m[0].length;
      if (cut > 0) {
        commit(text.slice(0, cut));
        input.value = text.slice(cut);
      }
    }
    renderLive();
  }

  input.addEventListener('input', onInput);
  input.addEventListener('click', renderLive);
  input.addEventListener('keyup', function (e) {
    if (e.key.indexOf('Arrow') === 0 || e.key === 'Home' || e.key === 'End') renderLive();
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      commit(input.value);
      input.value = '';
      renderLive();
    } else if (e.key === 'Tab' && !e.shiftKey && suggestions.length) {
      e.preventDefault();
      accept(0);
    }
  });
  $('suggest').addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep focus in textarea
  $('suggest').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-i]');
    if (b) accept(Number(b.dataset.i));
  });

  // ---- rendering ------------------------------------------------------------------------------

  var pendingNew = 0;

  function renderStats() {
    var a = lex.analyze();
    var items = [
      ['words', lex.size() + (pendingNew ? ' +' + pendingNew : '')],
      ['used', lex.totalTokens],
      ['sentences', lex.totalSentences],
      ['classes', a.classes.length],
      ['patterns', a.patterns.filter(function (p) { return p.count > 1; }).length]
    ];
    $('stats').innerHTML = items.map(function (it) {
      return '<div><dt>' + it[0] + '</dt><dd>' + esc(it[1]) + '</dd></div>';
    }).join('');
  }

  function renderTranscript(scroll) {
    var el = $('transcript');
    if (!history.length) {
      el.innerHTML = '<p class="empty"><strong>Nothing learned yet.</strong> Start typing below in any language. ' +
        'Every word you finish is new to WordWeave the first time, then it starts to notice which words follow which, ' +
        'groups words that behave alike into classes, and spots patterns in your sentences and word endings. ' +
        'You can also <em>Upload</em> documents (or drop them here) to teach it a lot at once, ' +
        'or press <em>Sample text</em> to see it work.</p>';
      return;
    }
    el.innerHTML = history.map(function (h) {
      if (h.doc) {
        var learnedHere = (h.fresh || []).filter(function (w) { return lex.has(w); });
        return '<div class="line doc"><div class="doc-head"><span class="badge">Document</span> <b>' + esc(h.doc.name) +
          '</b></div><div class="doc-meta">' + h.doc.sentences.toLocaleString() + ' sentences · ' +
          h.doc.tokens.toLocaleString() + ' words · ' + h.doc.newWords.toLocaleString() + ' new</div>' +
          '<p class="doc-excerpt">' + esc(h.text) + '</p>' +
          (learnedHere.length ? '<div class="doc-new">' + learnedHere.map(function (w) { return wordSpan(w, 'fresh'); }).join(' ') +
            (h.doc.newWords > learnedHere.length ? ' <span class="more">+' + (h.doc.newWords - learnedHere.length).toLocaleString() + ' more</span>' : '') +
            '</div>' : '') +
          '</div>';
      }
      var fresh = new Set(h.fresh || []);
      var body = '';
      var last = 0;
      h.text.replace(WORD_RE, function (w, offset) {
        body += esc(h.text.slice(last, offset));
        var key = WW.normalize(w);
        var isFresh = fresh.has(key);
        if (isFresh) fresh.delete(key); // highlight only where it was first seen
        body += lex.has(key) ? wordSpan(w, isFresh ? 'fresh' : '') : esc(w);
        last = offset + w.length;
        return w;
      });
      body += esc(h.text.slice(last));
      return '<p class="line' + (h.generated ? ' generated' : '') + '">' + body + '</p>';
    }).join('');
    // Only the latest line animates.
    var lines = el.querySelectorAll('.line');
    for (var i = 0; i < lines.length - 1; i++) {
      lines[i].querySelectorAll('.fresh').forEach(function (s) { s.style.animation = 'none'; });
    }
    if (scroll) el.scrollTop = el.scrollHeight;
  }

  function renderWords() {
    var filter = WW.normalize($('word-filter').value.trim());
    var sort = $('word-sort').value;
    var entries = Array.from(lex.words.entries()).filter(function (e) {
      return !filter || e[0].indexOf(filter) >= 0;
    });
    entries.sort(function (x, y) {
      if (sort === 'new') return y[1].first - x[1].first;
      if (sort === 'alpha') return x[0].localeCompare(y[0]);
      return y[1].count - x[1].count || x[0].localeCompare(y[0]);
    });
    var shown = entries.slice(0, 800);
    $('word-list').innerHTML = shown.length
      ? shown.map(function (e) { return chip(e[0], e[1].count); }).join('') +
        (entries.length > shown.length ? '<p class="empty-state">…and ' + (entries.length - shown.length) + ' more. Filter to find them.</p>' : '')
      : '<p class="empty-state">' + (lex.size() ? 'No words match.' : 'No words yet.') + '</p>';
  }

  function renderClasses() {
    var a = lex.analyze();
    if (!a.classes.length) {
      $('class-list').innerHTML = '<p class="empty-state">No classes yet. Classes appear once a few words have been used in similar places, ' +
        'e.g. "the cat sat" and "the dog sat".</p>';
      return;
    }
    $('class-list').innerHTML = a.classes.map(function (c) {
      var share = lex.totalTokens ? c.count / lex.totalTokens : 0;
      var rel = function (list, verb) {
        if (!list.length) return '';
        return '<div class="rel">' + verb + ' ' + list.map(function (r) {
          return '<b>' + esc(tagLabel(r.tag, a)) + '</b> ' + Math.round(r.share * 100) + '%';
        }).join(', ') + '</div>';
      };
      return '<div class="card" style="--h:' + hue(c.id) + '">' +
        '<h3><span class="dot"></span>' + c.name + ' <small>' + c.members.length + ' words · ' +
        Math.round(share * 100) + '% of everything typed</small></h3>' +
        '<div class="members">' + c.members.map(function (w) { return wordSpan(w); }).join(' ') + '</div>' +
        rel(c.precededBy, 'Comes after') + rel(c.followedBy, 'Followed by') +
        '<div class="bar"><span style="width:' + Math.max(2, share * 100) + '%"></span></div>' +
        '</div>';
    }).join('');
  }

  function renderPatterns() {
    var a = lex.analyze();
    var list = a.patterns.slice(0, 30);
    if (!list.length) {
      $('pattern-list').innerHTML = '<p class="empty-state">Patterns show up once words have been grouped into classes.</p>';
      return;
    }
    $('pattern-list').innerHTML = list.map(function (p) {
      var tags = p.pattern.split(' ').map(function (t) {
        if (t === '*') return '<span class="tag star" title="unclassed word">*</span>';
        var c = a.classes[Number(t.slice(1)) - 1];
        return '<span class="tag" style="--h:' + hue(c.id) + '" title="' + esc(c.label) + '">' + t + '</span>';
      }).join('');
      return '<div class="card"><div class="pattern">' + tags +
        '<small style="margin-left:auto;color:var(--muted)">×' + p.count + '</small></div>' +
        '<ul class="examples">' + p.examples.map(function (e) {
          return '<li>' + e.split(' ').map(function (w) { return wordSpan(w); }).join(' ') + '</li>';
        }).join('') + '</ul></div>';
    }).join('');
  }

  function renderForms() {
    var m = lex.analyze().morphology;
    if (!m.rules.length) {
      $('forms-list').innerHTML = '<p class="empty-state">No word forms yet. Teach pairs like "walk / walked" and "play / played" ' +
        'and the shared ending will appear here.</p>';
      return;
    }
    var rules = m.rules.slice(0, 25).map(function (r) {
      var label = r.kind === 'suffix' ? '-' + r.affix : r.affix + '-';
      return '<div class="card"><h3>' + esc(label) + ' <small>' + r.kind + ' · ' + r.examples.length + ' words</small></h3>' +
        '<div class="members">' + r.examples.slice(0, 12).map(function (ex) {
          return wordSpan(ex[0]) + ' → ' + wordSpan(ex[1]);
        }).join('<span style="color:var(--muted)">·</span>') + '</div></div>';
    }).join('');
    var fams = m.families.slice(0, 30).map(function (f) {
      return '<div class="members">' + f.forms.map(function (w) { return wordSpan(w); }).join(' / ') + '</div>';
    }).join('');
    $('forms-list').innerHTML = '<h4 class="caption">Affixes</h4>' + rules +
      '<h4 class="caption">Word families</h4><div class="card">' + fams + '</div>';
  }

  function renderTab() {
    if (currentTab === 'words') renderWords();
    else if (currentTab === 'classes') renderClasses();
    else if (currentTab === 'patterns') renderPatterns();
    else if (currentTab === 'forms') renderForms();
    else if (currentTab === 'map') { resizeGraph(); rebuildGraph(); }
  }

  function renderAll(scroll) {
    renderTranscript(scroll);
    renderStats();
    renderTab();
    if (openWord) openDrawer(openWord);
  }

  // ---- tabs -----------------------------------------------------------------------------------

  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (!b) return;
    currentTab = b.dataset.tab;
    document.querySelectorAll('.tabs button').forEach(function (t) {
      t.setAttribute('aria-selected', String(t === b));
    });
    document.querySelectorAll('.tab-body').forEach(function (body) {
      body.hidden = body.dataset.body !== currentTab;
    });
    renderTab();
  });
  $('word-filter').addEventListener('input', renderWords);
  $('word-sort').addEventListener('change', renderWords);

  // ---- word drawer ----------------------------------------------------------------------------

  var openWord = null;

  function openDrawer(word) {
    var d = lex.describe(word);
    if (!d) { closeDrawer(); return; }
    openWord = d.word;
    var pills = [];
    if (d.class) pills.push('<span class="pill" style="background:hsl(' + hue(d.class.id) + ' 60% var(--class-l));color:var(--panel)">' + d.class.name + '</span>');
    else pills.push('<span class="pill">no class yet</span>');
    if (d.nameLike) pills.push('<span class="pill">looks like a name</span>');
    if (d.starts) pills.push('<span class="pill">opens ' + d.starts + ' sentence' + (d.starts > 1 ? 's' : '') + '</span>');
    if (d.ends) pills.push('<span class="pill">ends ' + d.ends + ' sentence' + (d.ends > 1 ? 's' : '') + '</span>');
    function section(title, items, render) {
      if (!items || !items.length) return '';
      return '<h4>' + title + '</h4><div class="row">' + items.map(render).join('') + '</div>';
    }
    $('drawer-body').innerHTML =
      '<h2>' + esc(d.word) + '</h2>' +
      '<p class="meta">Used ' + d.count + '× (' + (d.frequency * 100).toFixed(1) + '% of all words) · first learned ' +
      ago(d.first) + ' · last used ' + ago(d.last) + '</p>' +
      '<div>' + pills.join('') + '</div>' +
      (d.class ? '<h4>Class ' + d.class.name + '</h4><div class="row">' +
        d.class.members.filter(function (w) { return w !== d.word; }).slice(0, 16).map(function (w) { return chip(w); }).join('') + '</div>' : '') +
      section('Often followed by', d.followers, function (e) { return chip(e[0], e[1]); }) +
      section('Often comes after', d.predecessors, function (e) { return chip(e[0], e[1]); }) +
      section('Used like', d.similar, function (e) { return chip(e[0], Math.round(e[1] * 100) + '%'); }) +
      section('Word family', (d.family || []).filter(function (w) { return w !== d.word; }), function (w) { return chip(w); }) +
      '<button class="forget danger" id="forget">Forget “' + esc(d.word) + '”</button>';
    $('drawer').hidden = false;
    $('forget').onclick = function () {
      lex.forget(d.word);
      save();
      toast('Forgot “' + d.word + '”');
      closeDrawer();
      renderAll(false);
      renderLive();
    };
  }

  function closeDrawer() {
    openWord = null;
    $('drawer').hidden = true;
  }

  document.addEventListener('click', function (e) {
    var w = e.target.closest('[data-word]');
    if (w && !e.target.closest('#graph')) openDrawer(w.dataset.word);
  });
  $('drawer-close').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  // ---- header actions -------------------------------------------------------------------------

  $('btn-babble').addEventListener('click', babble);
  $('file-upload').accept = DOCS.ACCEPT;
  $('file-upload').addEventListener('change', function (e) {
    learnFiles(e.target.files);
    e.target.value = '';
  });

  // Drag documents anywhere onto the page.
  var dragDepth = 0;
  function hasFiles(e) {
    return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0;
  }
  document.addEventListener('dragenter', function (e) {
    if (!hasFiles(e)) return;
    dragDepth++;
    document.body.classList.add('dropping');
  });
  document.addEventListener('dragleave', function (e) {
    if (!hasFiles(e)) return;
    if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dropping'); }
  });
  document.addEventListener('dragover', function (e) {
    if (hasFiles(e)) e.preventDefault();
  });
  document.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('dropping');
    learnFiles(e.dataTransfer.files);
  });
  $('btn-sample').addEventListener('click', function () { commit(SAMPLE.join('\n')); });
  $('btn-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify({ lexicon: lex.toJSON(), history: history }, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wordweave-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('file-import').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    file.text().then(function (text) {
      var data = JSON.parse(text);
      lex = WW.Lexicon.fromJSON(data.lexicon || data);
      history = data.history || [];
      graph.nodes = new Map();
      save();
      renderAll(true);
      renderLive();
      toast('Imported ' + lex.size() + ' words');
    }).catch(function (err) {
      toast('Could not import: ' + err.message);
    });
    e.target.value = '';
  });
  $('btn-reset').addEventListener('click', function () {
    if (!confirm('Forget every word and pattern learned so far?')) return;
    lex = new WW.Lexicon();
    history = [];
    graph.nodes = new Map();
    save();
    closeDrawer();
    renderAll(false);
    renderLive();
  });

  // ---- word map (force-directed graph) --------------------------------------------------------

  var canvas = $('graph');
  var ctx = canvas.getContext('2d');
  var graph = { nodes: new Map(), edges: [], alpha: 0, drag: null, hover: null, w: 0, h: 0, raf: 0, moved: false };

  function classLightness() {
    return getComputedStyle(document.documentElement).getPropertyValue('--class-l').trim() || '45%';
  }

  function resizeGraph() {
    var r = canvas.getBoundingClientRect();
    if (!r.width) return;
    var dpr = window.devicePixelRatio || 1;
    graph.w = r.width;
    graph.h = r.height;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function rebuildGraph() {
    var a = lex.analyze();
    var top = Array.from(lex.words.entries())
      .sort(function (x, y) { return y[1].count - x[1].count || (x[0] < y[0] ? -1 : 1); })
      .slice(0, graph.w && graph.w < 600 ? 35 : 70);
    var keep = new Set(top.map(function (e) { return e[0]; }));
    var nodes = new Map();
    var edges = [];
    top.forEach(function (e) {
      var w = e[0];
      lex.next.get(w) && lex.next.get(w).forEach(function (n, b) {
        if (keep.has(b) && b !== w) edges.push({ a: w, b: b, n: n });
      });
    });
    var cx = graph.w / 2 || 200, cy = graph.h / 2 || 160;
    top.forEach(function (e) {
      var w = e[0];
      var node = graph.nodes.get(w);
      if (!node) {
        // Place a new word next to a word it is connected to, so the map grows instead of reshuffling.
        var anchor = null;
        edges.some(function (ed) {
          var other = ed.a === w ? ed.b : ed.b === w ? ed.a : null;
          if (other && graph.nodes.has(other)) { anchor = graph.nodes.get(other); return true; }
          return false;
        });
        var ang = Math.random() * Math.PI * 2;
        node = {
          w: w,
          x: (anchor ? anchor.x : cx) + Math.cos(ang) * (anchor ? 30 : 60 * Math.random()),
          y: (anchor ? anchor.y : cy) + Math.sin(ang) * (anchor ? 30 : 60 * Math.random()),
          vx: 0, vy: 0, born: performance.now()
        };
      }
      node.count = e[1].count;
      node.r = 5 + Math.min(14, Math.sqrt(e[1].count) * 2.2);
      node.cls = a.classOf.has(w) ? a.classOf.get(w) : null;
      nodes.set(w, node);
    });
    graph.nodes = nodes;
    graph.edges = edges;
    graph.maxEdge = edges.reduce(function (m, e) { return Math.max(m, e.n); }, 1);
    kick(1);
  }

  function kick(alpha) {
    graph.alpha = Math.max(graph.alpha, alpha);
    if (!graph.raf) graph.raf = requestAnimationFrame(step);
  }

  function step() {
    graph.raf = 0;
    if (currentTab !== 'map' || !graph.w) return;
    var nodes = Array.from(graph.nodes.values());
    var alpha = graph.alpha;
    var cx = graph.w / 2, cy = graph.h / 2;
    for (var i = 0; i < nodes.length; i++) {
      var p = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var q = nodes[j];
        var dx = q.x - p.x, dy = q.y - p.y;
        var d2 = dx * dx + dy * dy + 0.01;
        if (d2 > 90000) continue;
        var f = Math.min(8, 1400 / d2) * alpha;
        var d = Math.sqrt(d2);
        dx /= d; dy /= d;
        p.vx -= dx * f; p.vy -= dy * f;
        q.vx += dx * f; q.vy += dy * f;
      }
      p.vx += (cx - p.x) * 0.004 * alpha;
      p.vy += (cy - p.y) * 0.004 * alpha;
    }
    graph.edges.forEach(function (e) {
      var p = graph.nodes.get(e.a), q = graph.nodes.get(e.b);
      var dx = q.x - p.x, dy = q.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var k = 0.03 * Math.min(3, 1 + Math.log(e.n)) * alpha;
      var f = (d - 80) * k;
      dx /= d; dy /= d;
      p.vx += dx * f; p.vy += dy * f;
      q.vx -= dx * f; q.vy -= dy * f;
    });
    nodes.forEach(function (n) {
      if (n === graph.drag) { n.vx = n.vy = 0; return; }
      n.vx *= 0.8; n.vy *= 0.8;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(n.r + 2, Math.min(graph.w - n.r - 2, n.x));
      n.y = Math.max(n.r + 2, Math.min(graph.h - n.r - 2, n.y));
    });
    graph.alpha *= 0.985;
    draw();
    if (graph.alpha > 0.02 || graph.drag) graph.raf = requestAnimationFrame(step);
  }

  function draw() {
    if (!graph.w) return;
    var css = getComputedStyle(document.documentElement);
    var ink = css.getPropertyValue('--ink').trim();
    var muted = css.getPropertyValue('--muted').trim();
    var L = classLightness();
    ctx.clearRect(0, 0, graph.w, graph.h);
    if (!graph.nodes.size) {
      ctx.fillStyle = muted;
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Words you teach will appear here.', graph.w / 2, graph.h / 2);
      return;
    }
    var hover = graph.hover;
    var now = performance.now();
    graph.edges.forEach(function (e) {
      var p = graph.nodes.get(e.a), q = graph.nodes.get(e.b);
      var lit = hover && (hover === p || hover === q);
      ctx.globalAlpha = hover ? (lit ? 0.9 : 0.08) : 0.18 + 0.5 * (e.n / graph.maxEdge);
      ctx.strokeStyle = lit ? ink : muted;
      ctx.lineWidth = 0.8 + 2.2 * (e.n / graph.maxEdge);
      var dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var ex = q.x - dx / d * (q.r + 2), ey = q.y - dy / d * (q.r + 2);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      var ah = 6, ang = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - ah * Math.cos(ang - 0.45), ey - ah * Math.sin(ang - 0.45));
      ctx.lineTo(ex - ah * Math.cos(ang + 0.45), ey - ah * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    var linked = new Set();
    if (hover) graph.edges.forEach(function (e) {
      if (e.a === hover.w) linked.add(e.b);
      if (e.b === hover.w) linked.add(e.a);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    graph.nodes.forEach(function (n) {
      var dim = hover && n !== hover && !linked.has(n.w);
      ctx.globalAlpha = dim ? 0.25 : 1;
      var age = (now - (n.born || 0)) / 600;
      var r = n.r * (age < 1 ? 1 + 0.6 * (1 - age) : 1);
      if (age < 1) kick(0.03);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.cls === null ? muted : 'hsl(' + hue(n.cls) + ' 60% ' + L + ')';
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.font = (n === hover ? '600 ' : '') + (11 + Math.min(5, Math.sqrt(n.count))) + 'px system-ui, sans-serif';
      ctx.fillText(n.w, n.x + r + 4, n.y);
    });
    ctx.globalAlpha = 1;
  }

  function nodeAt(x, y) {
    var found = null;
    graph.nodes.forEach(function (n) {
      var dx = n.x - x, dy = n.y - y;
      if (dx * dx + dy * dy <= (n.r + 4) * (n.r + 4)) found = n;
    });
    return found;
  }

  function pointer(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  canvas.addEventListener('pointerdown', function (e) {
    var p = pointer(e);
    var n = nodeAt(p.x, p.y);
    if (!n) return;
    graph.drag = n;
    graph.moved = false;
    canvas.setPointerCapture(e.pointerId);
    kick(0.3);
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = pointer(e);
    if (graph.drag) {
      graph.moved = true;
      graph.drag.x = p.x;
      graph.drag.y = p.y;
      kick(0.3);
      return;
    }
    var n = nodeAt(p.x, p.y);
    if (n !== graph.hover) {
      graph.hover = n;
      canvas.style.cursor = n ? 'pointer' : 'default';
      draw();
    }
  });
  canvas.addEventListener('pointerup', function () {
    var n = graph.drag;
    graph.drag = null;
    if (n && !graph.moved) openDrawer(n.w);
  });
  canvas.addEventListener('pointerleave', function () {
    if (graph.hover) { graph.hover = null; draw(); }
  });

  if (window.ResizeObserver) new ResizeObserver(function () { resizeGraph(); kick(0.2); }).observe(canvas);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { draw(); renderAll(false); });

  // ---- start ----------------------------------------------------------------------------------

  load();
  renderAll(true);
  renderLive();
  input.focus();
})();
