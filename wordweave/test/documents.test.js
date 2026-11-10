'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const docs = require('../documents.js');
const { Lexicon } = require('../lexicon.js');

const enc = (s) => new TextEncoder().encode(s);

/** Build a minimal zip archive (deflated entries) like the ones Word, LibreOffice and EPUB tools write. */
function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name);
    const data = Buffer.from(content);
    const comp = zlib.deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, comp);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(entries).length, 8);
  eocd.writeUInt16LE(Object.keys(entries).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, eocd]));
}

test('plain text, including Windows-1252 files', async () => {
  assert.equal((await docs.extractText('a.txt', enc('Hello  world.\r\nSecond line.'))).text, 'Hello world.\nSecond line.');
  const latin1 = new Uint8Array([0x43, 0x61, 0x66, 0xe9, 0x20, 0x6e, 0x6f, 0x69, 0x72, 0x2e, 0x20, 0x43, 0x61, 0x66, 0xe9, 0x2e]);
  assert.equal((await docs.extractText('menu.txt', latin1)).text, 'Café noir. Café.');
});

test('markdown keeps prose and drops markup', async () => {
  const md = '# Title\n\nSome **bold** and _soft_ text with a [link](http://x.y).\n\n```js\nconst code = 1;\n```\n- item one\n';
  const { text } = await docs.extractText('notes.md', enc(md));
  assert.equal(text.replace(/\n+/g, '\n'), 'Title\nSome bold and soft text with a link.\nitem one');
});

test('html drops scripts, styles and tags', async () => {
  const html = '<html><head><title>T</title><style>p{}</style></head><body><p>One &amp; two.</p><script>var x</script><div>Three&nbsp;four</div></body></html>';
  assert.equal((await docs.extractText('page.html', enc(html))).text.replace(/\n+/g, '\n'), 'One & two.\nThree four');
});

test('csv cells become separate lines', async () => {
  const csv = 'name,comment\n"Smith, Ann","She said ""hi"" today"\n';
  assert.equal((await docs.extractText('d.csv', enc(csv))).text, 'name\ncomment\nSmith, Ann\nShe said "hi" today');
});

test('subtitles drop numbers and timestamps', async () => {
  const srt = '1\n00:00:01,000 --> 00:00:02,000\n<i>Hello there.</i>\n\n2\n00:00:03,000 --> 00:00:04,000\nGeneral greeting.\n';
  assert.equal((await docs.extractText('film.srt', enc(srt))).text, 'Hello there.\n\nGeneral greeting.');
});

test('json strings are collected', async () => {
  const { text } = await docs.extractText('d.json', enc('{"a":"The cat sat.","n":3,"list":["A dog ran.","https://x.y"]}'));
  assert.equal(text, 'The cat sat.\nA dog ran.');
});

test('docx paragraphs and runs', async () => {
  const xml = '<?xml version="1.0"?><w:document><w:body>' +
    '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter One</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t xml:space="preserve">The cat </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>sat</w:t></w:r><w:r><w:t> on the mat &amp; slept.</w:t></w:r></w:p>' +
    '<w:p/></w:body></w:document>';
  const bytes = zip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': xml });
  const { text, kind } = await docs.extractText('story.docx', bytes);
  assert.equal(kind, 'docx');
  assert.equal(text, 'Chapter One\nThe cat sat on the mat & slept.');
});

test('odt paragraphs', async () => {
  const xml = '<office:document-content><office:body><office:text><text:h>Heading</text:h>' +
    '<text:p>First<text:s/>para.</text:p><text:p>Second one.</text:p></office:text></office:body></office:document-content>';
  const { text } = await docs.extractText('a.odt', zip({ mimetype: 'application/vnd.oasis.opendocument.text', 'content.xml': xml }));
  assert.equal(text, 'Heading\nFirst para.\nSecond one.');
});

test('epub follows the spine order', async () => {
  const opf = '<package><manifest><item id="c2" href="ch2.xhtml"/><item id="c1" href="ch1.xhtml"/></manifest>' +
    '<spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>';
  const bytes = zip({
    'OEBPS/ch2.xhtml': '<html><body><p>Second chapter.</p></body></html>',
    'OEBPS/content.opf': opf,
    'OEBPS/ch1.xhtml': '<html><body><p>First chapter.</p></body></html>'
  });
  assert.equal((await docs.extractText('book.epub', bytes)).text, 'First chapter.\n\nSecond chapter.');
});

test('pdf line joining re-joins hyphenated words', () => {
  assert.equal(docs.pdfLinesToText('The quick brown fox jum-\nped over the\nlazy dog.\n\nNext para.'),
    'The quick brown fox jumped over the lazy dog.\nNext para.');
});

test('unsupported and broken files give clear errors', async () => {
  await assert.rejects(docs.extractText('old.doc', enc('x')), /\.docx/);
  await assert.rejects(docs.extractText('bad.docx', enc('not a zip')), /damaged/);
});

test('extracted text is learnable', async () => {
  const bytes = zip({ 'word/document.xml': '<w:document><w:body><w:p><w:r><w:t>The cat sat. The dog sat.</w:t></w:r></w:p></w:body></w:document>' });
  const lex = new Lexicon();
  const res = lex.learn((await docs.extractText('x.docx', bytes)).text);
  assert.deepEqual(res.newWords, ['the', 'cat', 'sat', 'dog']);
  assert.equal(res.sentences, 2);
});
