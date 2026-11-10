#!/usr/bin/env node
// Character card PNG tool. Zero dependencies, Node 18+.
//
//   node tools/card.mjs build <characterDir> --image <portrait.png>
//       Reads <characterDir>/card.json (Character Card V3, the single source),
//       derives the V2 object from it, and writes <characterDir>/card.png with
//       both embedded: tEXt chunk `ccv3` (V3) and tEXt chunk `chara` (V2).
//       Every other chunk of the portrait is kept, so the generation
//       parameters already stored in the image travel with the card.
//
//   node tools/card.mjs read <card.png>
//       Prints what a frontend would find inside the PNG.
//
// Format: both chunks hold the JSON as UTF-8, then base64, as the specs ask.
//   V2: https://github.com/malfoyslastname/character-card-spec-v2
//   V3: https://github.com/kwaroran/character-card-spec-v3

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CARD_KEYWORDS = new Set(['chara', 'ccv3']);
const V3_ONLY = ['assets', 'nickname', 'creator_notes_multilingual', 'source',
  'group_only_greetings', 'creation_date', 'modification_date'];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function readChunks(png) {
  if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG file');
  const chunks = [];
  let at = 8;
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const type = png.toString('latin1', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    const stored = png.readUInt32BE(at + 8 + length);
    const actual = crc32(png.subarray(at + 4, at + 8 + length));
    if (stored !== actual) throw new Error(`bad CRC in ${type} chunk`);
    chunks.push({ type, data });
    at += 12 + length;
  }
  return chunks;
}

function writeChunks(chunks) {
  const parts = [SIGNATURE];
  for (const { type, data } of chunks) {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'latin1');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    parts.push(head, data, crc);
  }
  return Buffer.concat(parts);
}

function textChunk(keyword, text) {
  return { type: 'tEXt', data: Buffer.concat([Buffer.from(keyword, 'latin1'), Buffer.from([0]), Buffer.from(text, 'latin1')]) };
}

function splitText(chunk) {
  const zero = chunk.data.indexOf(0);
  return { keyword: chunk.data.toString('latin1', 0, zero), text: chunk.data.toString('latin1', zero + 1) };
}

const encode = (object) => Buffer.from(JSON.stringify(object), 'utf8').toString('base64');
const decode = (text) => JSON.parse(Buffer.from(text, 'base64').toString('utf8'));

// V2 object for frontends that predate V3. The V1 fields are repeated at the
// top level because several importers still read them from there.
export function toV2(v3) {
  const data = { ...v3.data };
  for (const key of V3_ONLY) delete data[key];
  const { name, description, personality, scenario, first_mes, mes_example } = data;
  return { name, description, personality, scenario, first_mes, mes_example, spec: 'chara_card_v2', spec_version: '2.0', data };
}

function validate(v3) {
  const problems = [];
  if (v3.spec !== 'chara_card_v3') problems.push('spec must be "chara_card_v3"');
  if (v3.spec_version !== '3.0') problems.push('spec_version must be "3.0"');
  const strings = ['name', 'description', 'creator', 'character_version', 'mes_example', 'system_prompt',
    'post_history_instructions', 'first_mes', 'personality', 'scenario', 'creator_notes'];
  for (const key of strings) if (typeof v3.data?.[key] !== 'string') problems.push(`data.${key} must be a string`);
  for (const key of ['tags', 'alternate_greetings', 'group_only_greetings']) {
    if (!Array.isArray(v3.data?.[key])) problems.push(`data.${key} must be an array`);
  }
  if (typeof v3.data?.extensions !== 'object' || v3.data.extensions === null) problems.push('data.extensions must be an object');
  if (problems.length) throw new Error(`card.json is not a valid V3 card:\n  ${problems.join('\n  ')}`);
}

function build(characterDir, imagePath) {
  const v3 = JSON.parse(readFileSync(join(characterDir, 'card.json'), 'utf8'));
  validate(v3);
  const kept = readChunks(readFileSync(imagePath))
    .filter((c) => !(c.type === 'tEXt' && CARD_KEYWORDS.has(splitText(c).keyword)));
  const end = kept.findIndex((c) => c.type === 'IEND');
  kept.splice(end, 0, textChunk('chara', encode(toV2(v3))), textChunk('ccv3', encode(v3)));
  const out = join(characterDir, 'card.png');
  writeFileSync(out, writeChunks(kept));
  console.log(`wrote ${out}`);
  read(out);
}

function read(pngPath) {
  const chunks = readChunks(readFileSync(pngPath));
  const ihdr = chunks.find((c) => c.type === 'IHDR').data;
  console.log(`${pngPath}: ${ihdr.readUInt32BE(0)}x${ihdr.readUInt32BE(4)}`);
  for (const chunk of chunks.filter((c) => c.type === 'tEXt')) {
    const { keyword, text } = splitText(chunk);
    if (!CARD_KEYWORDS.has(keyword)) {
      console.log(`  ${keyword}: ${text.split('\n')[0].slice(0, 100)}`);
      continue;
    }
    const card = decode(text);
    const data = card.data ?? card;
    console.log(`  ${keyword}: ${card.spec} ${card.spec_version}, "${data.name}" by ${data.creator}, `
      + `${data.description.length} chars of description, ${data.alternate_greetings.length + 1} greetings, tags: ${data.tags.join(', ')}`);
  }
}

const [command, target, ...rest] = process.argv.slice(2);
try {
  if (command === 'build' && target && rest[0] === '--image' && rest[1]) build(target, rest[1]);
  else if (command === 'read' && target) read(target);
  else {
    console.error('usage:\n  node tools/card.mjs build <characterDir> --image <portrait.png>\n  node tools/card.mjs read <card.png>');
    process.exit(1);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
