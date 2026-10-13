#!/usr/bin/env node
// scripts/why-notes.json'daki "Neden?" notlarını kataloğa yazar
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '..', 'src', 'data', 'catalog.json');
const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const notes = JSON.parse(fs.readFileSync(path.join(here, 'why-notes.json'), 'utf8'));
let n = 0; const miss = [];
for (const [k, v] of Object.entries(notes)) {
  if (k.startsWith('_')) continue;
  const [u, title, year, type] = k.split('|');
  const hits = d.catalog.filter((t) => t.u === u && t.title === title && (!year || t.year === +year) && (!type || t.type === type));
  if (hits.length !== 1) { miss.push(`${k} (${hits.length})`); continue; }
  if (hits[0].why !== v) { hits[0].why = v; n++; }
}
fs.writeFileSync(FILE, JSON.stringify(d));
console.log(`${n} not yazıldı.`, miss.length ? `Eşleşmeyen: ${miss.join(', ')}` : '');
