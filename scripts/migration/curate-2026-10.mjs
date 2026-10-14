#!/usr/bin/env node
/**
 * Evren düzenlemesi (Ekim 2026):
 *  - Tek hat ilerleyen seriler ve tek diziler evren listesinden çıkar; işaretli olanlar
 *    uygulamada kütüphaneye normal film/dizi olarak taşınır (catalog.moved).
 *  - Predator, Alien evrenine katılır: "Alien & Predator".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '..', '..', 'src', 'data', 'catalog.json');
const SRC = path.join(here, '..', 'sources.json');
const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const REMOVE = ['mi', 'bond', 'rocky', 'pirates', 'avatar', 'strangerthings', 'invincible'];

d.moved = d.moved || {};
for (const t of d.catalog.filter((x) => REMOVE.includes(x.u))) {
  if (t.tmdb?.id > 0) d.moved[t.id] = { k: `${t.tmdb.m || t.media}:${t.tmdb.id}`, title: t.title, year: t.year, p: t.tmdb.p || null, b: t.tmdb.b || null, minutes: t.minutes || null, eps: t.episodes || 0 };
}
d.catalog = d.catalog.filter((x) => !REMOVE.includes(x.u));
d.universes = d.universes.filter((u) => !REMOVE.includes(u.id));

// Predator → Alien
for (const t of d.catalog) if (t.u === 'predator') t.u = 'alien';
const alien = d.universes.find((u) => u.id === 'alien');
alien.name = 'Alien & Predator';
alien.short = 'ALIEN · PREDATOR';
alien.desc = 'Ridley Scott’un başlattığı korku serisi, Avcı’nın filmleri ve ikisinin kesiştiği yapımlar.';
alien.defaultBranch = 'all';
d.universes = d.universes.filter((u) => u.id !== 'predator');
d.mergedUniverses = { ...(d.mergedUniverses || {}), predator: 'alien' };
for (const id of REMOVE) d.mergedUniverses[id] = null;

fs.writeFileSync(FILE, JSON.stringify(d));
const s = JSON.parse(fs.readFileSync(SRC, 'utf8'));
s.sources = s.sources.filter((x) => !REMOVE.includes(x.u)).map((x) => (x.u === 'predator' ? { ...x, u: 'alien' } : x));
fs.writeFileSync(SRC, JSON.stringify(s, null, 2) + '\n');
console.log(`Evrenler: ${d.universes.length} · yapım: ${d.catalog.length} · taşınan: ${Object.keys(d.moved).length}`);
