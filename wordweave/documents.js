/*
 * WordWeave document reader: turns uploaded files into plain text for the lexicon to learn from.
 *
 * Everything runs locally in the browser. Nothing is uploaded anywhere.
 *   - plain text, Markdown, HTML, CSV/TSV, JSON, SRT/VTT subtitles: decoded and cleaned up
 *   - .docx, .odt, .epub: these are zip files, unpacked with the browser's DecompressionStream
 *   - .pdf: read with pdf.js, which is loaded from cdnjs the first time a PDF is opened
 *
 * Loaded by index.html as a classic script (window.WordWeaveDocs) and by Node for tests.
 */
(function (global) {
  'use strict';

  var PDFJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var MAX_BYTES = 50 * 1024 * 1024;
  var KINDS = {
    txt: 'text', text: 'text', log: 'text',
    md: 'markdown', markdown: 'markdown',
    html: 'html', htm: 'html', xhtml: 'html',
    csv: 'csv', tsv: 'csv',
    json: 'json',
    srt: 'subtitles', vtt: 'subtitles',
    docx: 'docx', odt: 'odt', epub: 'epub', pdf: 'pdf'
  };
  var ACCEPT = Object.keys(KINDS).map(function (e) { return '.' + e; }).join(',');
  var UNSUPPORTED = {
    doc: 'Old Word (.doc) files can’t be read. Save it as .docx or PDF and try again.',
    pages: 'Pages files can’t be read. Export it as .docx or PDF and try again.',
    rtf: 'RTF files can’t be read. Save it as .docx, PDF or plain text and try again.'
  };

  function extension(name) {
    var m = /\.([^.\/\\]+)$/.exec(String(name || '').toLowerCase());
    return m ? m[1] : '';
  }

  function kindOf(name) {
    return KINDS[extension(name)] || null;
  }

  // ---- text helpers ---------------------------------------------------------------------------

  var ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–',
    hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };

  function decodeEntities(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (all, e) {
      if (e[0] === '#') {
        var code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        try { return String.fromCodePoint(code); } catch (err) { return ' '; }
      }
      var v = ENTITIES[e.toLowerCase()];
      return v === undefined ? all : v;
    });
  }

  function decodeBytes(bytes) {
    var text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
      // Not valid UTF-8: most likely an older Windows/Western file.
      text = new TextDecoder('windows-1252').decode(bytes);
    }
    return text.replace(/^\uFEFF/, '');
  }

  function tidy(text) {
    return text
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t ]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  var BLOCK_TAGS = 'p|div|br|li|ul|ol|h[1-6]|tr|td|th|table|section|article|header|footer|aside|nav|blockquote|pre|title|dt|dd|figcaption|hr';

  function htmlToText(html) {
    return tidy(decodeEntities(String(html)
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|template|svg|head)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(new RegExp('<\\/?(?:' + BLOCK_TAGS + ')\\b[^>]*>', 'gi'), '\n')
      .replace(/<[^>]+>/g, '')));
  }

  function markdownToText(md) {
    return tidy(htmlToText(String(md)
      .replace(/```[\s\S]*?```/g, '\n')
      .replace(/`[^`\n]*`/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}(#{1,6}|>+|[-*+]|\d+[.)])\s+/gm, '')
      .replace(/^\s*([-*_]\s*){3,}$/gm, '\n')
      .replace(/(\*\*|__|\*|_|~~)(?=\S)([^\n]*?\S)\1/g, '$2')
      .replace(/\|/g, '\n')
      .replace(/https?:\/\/\S+/g, ' ')));
  }

  function subtitlesToText(s) {
    return tidy(String(s)
      .replace(/^WEBVTT.*$/m, '')
      .split('\n')
      .filter(function (line) { return !/^\s*\d+\s*$/.test(line) && !/-->/.test(line) && !/^(NOTE|STYLE|REGION)\b/.test(line); })
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\{[^}]*\}/g, ''));
  }

  /** Each CSV cell becomes its own line, so words in different cells are never treated as neighbours. */
  function csvToText(s, delimiter) {
    var cells = [], cell = '', quoted = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (quoted) {
        if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"' && !cell.trim()) {
        quoted = true;
      } else if (c === delimiter || c === '\n' || c === '\r') {
        cells.push(cell); cell = '';
      } else {
        cell += c;
      }
    }
    cells.push(cell);
    return tidy(cells.map(function (x) { return x.trim(); }).filter(Boolean).join('\n'));
  }

  function jsonToText(s) {
    var out = [];
    (function walk(v) {
      if (typeof v === 'string') { if (/\p{L}/u.test(v) && !/^https?:\/\//.test(v)) out.push(v); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k]); });
    })(JSON.parse(s));
    return tidy(out.join('\n'));
  }

  function docxXmlToText(xml) {
    var paras = String(xml)
      .replace(/<w:tab\/>/g, ' ')
      .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
      .match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
    return tidy(paras.map(function (p) {
      var runs = p.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>|\n/g) || [];
      return runs.map(function (r) { return r === '\n' ? '\n' : r.replace(/<[^>]+>/g, ''); }).join('');
    }).map(decodeEntities).join('\n'));
  }

  function odtXmlToText(xml) {
    var body = String(xml).replace(/^[\s\S]*?<office:body>/, '');
    return tidy(decodeEntities(body
      .replace(/<text:(?:s|tab)\b[^>]*\/>/g, ' ')
      .replace(/<text:line-break\/>/g, '\n')
      .replace(/<\/text:(?:p|h)>/g, '\n')
      .replace(/<[^>]+>/g, '')));
  }

  function pdfLinesToText(text) {
    return tidy(text
      .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2') // re-join words hyphenated across lines
      .replace(/\n{2,}/g, '\u0000')
      .replace(/\n/g, ' ')
      .replace(/\u0000/g, '\n'));
  }

  // ---- zip ------------------------------------------------------------------------------------

  async function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser can’t unpack compressed documents. Try a recent Chrome, Edge, Firefox or Safari.');
    }
    var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** Read entries of a zip archive. want(name) picks which entries to decompress. */
  async function unzip(bytes, want) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var eocd = -1;
    for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('The file is damaged or not really this format.');
    var count = dv.getUint16(eocd + 10, true);
    var off = dv.getUint32(eocd + 16, true);
    var utf8 = new TextDecoder('utf-8');
    var out = [];
    for (var n = 0; n < count; n++) {
      if (dv.getUint32(off, true) !== 0x02014b50) throw new Error('The file is damaged.');
      var method = dv.getUint16(off + 10, true);
      var csize = dv.getUint32(off + 20, true);
      var nlen = dv.getUint16(off + 28, true);
      var xlen = dv.getUint16(off + 30, true);
      var clen = dv.getUint16(off + 32, true);
      var local = dv.getUint32(off + 42, true);
      var name = utf8.decode(bytes.subarray(off + 46, off + 46 + nlen));
      off += 46 + nlen + xlen + clen;
      if (!want(name)) continue;
      var start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      var data = bytes.subarray(start, start + csize);
      if (method === 0) out.push({ name: name, data: data });
      else if (method === 8) out.push({ name: name, data: await inflateRaw(data) });
    }
    return out;
  }

  async function zipText(bytes, want) {
    var utf8 = new TextDecoder('utf-8');
    return (await unzip(bytes, want)).map(function (e) { return { name: e.name, text: utf8.decode(e.data) }; });
  }

  async function epubToText(bytes, onProgress) {
    var files = await zipText(bytes, function (n) { return /\.(x?html?|opf)$/i.test(n); });
    var byName = new Map(files.map(function (f) { return [f.name, f.text]; }));
    var order = files.filter(function (f) { return !/\.opf$/i.test(f.name); }).map(function (f) { return f.name; });
    var opf = files.filter(function (f) { return /\.opf$/i.test(f.name); })[0];
    if (opf) {
      // Follow the book's reading order (the spine) when it is there.
      var dir = opf.name.replace(/[^\/]*$/, '');
      var hrefs = {};
      (opf.text.match(/<item\b[^>]*>/g) || []).forEach(function (tag) {
        var id = /\bid="([^"]*)"/.exec(tag), href = /\bhref="([^"]*)"/.exec(tag);
        if (id && href) hrefs[id[1]] = dir + decodeURIComponent(href[1]);
      });
      var spine = (opf.text.match(/<itemref\b[^>]*>/g) || []).map(function (tag) {
        var id = /\bidref="([^"]*)"/.exec(tag);
        return id && hrefs[id[1]];
      }).filter(function (n) { return n && byName.has(n); });
      if (spine.length) order = spine;
    }
    return tidy(order.map(function (n, i) {
      if (onProgress) onProgress((i + 1) / order.length);
      return htmlToText(byName.get(n));
    }).join('\n\n'));
  }

  // ---- pdf ------------------------------------------------------------------------------------

  var pdfjsPromise = null;

  function loadPdfjs() {
    if (global.pdfjsLib) return Promise.resolve(global.pdfjsLib);
    if (pdfjsPromise) return pdfjsPromise;
    pdfjsPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = PDFJS_BASE + 'pdf.min.js';
      s.onload = function () {
        var lib = global.pdfjsLib;
        if (!lib) { reject(new Error('The PDF reader did not load.')); return; }
        lib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
        resolve(lib);
      };
      s.onerror = function () {
        pdfjsPromise = null;
        reject(new Error('Couldn’t load the PDF reader. Check your connection and try again.'));
      };
      document.head.appendChild(s);
    });
    return pdfjsPromise;
  }

  async function pdfToText(bytes, onProgress) {
    var lib = await loadPdfjs();
    var pdf = await lib.getDocument({ data: bytes }).promise;
    var pages = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var content = await page.getTextContent();
      pages.push(content.items.map(function (it) { return (it.str || '') + (it.hasEOL ? '\n' : ''); }).join(''));
      if (onProgress) onProgress(i / pdf.numPages);
    }
    var text = pdfLinesToText(pages.join('\n'));
    if (!/\p{L}/u.test(text)) throw new Error('No text found. It may be a scanned PDF, which would need OCR first.');
    return text;
  }

  // ---- entry point ----------------------------------------------------------------------------

  /**
   * Extract plain text from a file's bytes. Resolves to {text, kind}.
   * onProgress(fraction) is called for formats that take a while (PDF, EPUB).
   */
  async function extractText(name, bytes, onProgress) {
    var ext = extension(name);
    if (UNSUPPORTED[ext]) throw new Error(UNSUPPORTED[ext]);
    var kind = KINDS[ext] || 'text';
    if (bytes.byteLength > MAX_BYTES) throw new Error('Files over 50 MB are too big to learn from in the browser.');
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    var text;
    switch (kind) {
      case 'docx': {
        var doc = await zipText(bytes, function (n) { return n === 'word/document.xml'; });
        if (!doc.length) throw new Error('This doesn’t look like a Word document.');
        text = docxXmlToText(doc[0].text);
        break;
      }
      case 'odt': {
        var content = await zipText(bytes, function (n) { return n === 'content.xml'; });
        if (!content.length) throw new Error('This doesn’t look like an OpenDocument file.');
        text = odtXmlToText(content[0].text);
        break;
      }
      case 'epub': text = await epubToText(bytes, onProgress); break;
      case 'pdf': text = await pdfToText(bytes, onProgress); break;
      default: {
        var raw = decodeBytes(bytes);
        if (kind === 'html') text = htmlToText(raw);
        else if (kind === 'markdown') text = markdownToText(raw);
        else if (kind === 'subtitles') text = subtitlesToText(raw);
        else if (kind === 'csv') text = csvToText(raw, ext === 'tsv' ? '\t' : ',');
        else if (kind === 'json') text = jsonToText(raw);
        else if (/^\s*<(!doctype html|html)\b/i.test(raw)) { kind = 'html'; text = htmlToText(raw); }
        else text = tidy(raw);
      }
    }
    return { text: text, kind: kind };
  }

  var api = {
    ACCEPT: ACCEPT,
    extractText: extractText,
    kindOf: kindOf,
    htmlToText: htmlToText,
    markdownToText: markdownToText,
    subtitlesToText: subtitlesToText,
    csvToText: csvToText,
    jsonToText: jsonToText,
    docxXmlToText: docxXmlToText,
    odtXmlToText: odtXmlToText,
    pdfLinesToText: pdfLinesToText,
    unzip: unzip
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.WordWeaveDocs = api;
})(typeof window !== 'undefined' ? window : globalThis);
