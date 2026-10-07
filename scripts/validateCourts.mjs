// Court data validator & duplicate checker.
// Usage:
//   node scripts/validateCourts.mjs                 -> audit existing data (exit 1 on errors)
//   node scripts/validateCourts.mjs candidate.json  -> check a recommended court before adding
import fs from 'node:fs';
import { AUSTIN_COURTS_DATA, SPORT_META, DISTRICT_META } from '../src/data/courtsMeta.js';

const REQUIRED = ['id', 'name', 'district', 'sport', 'address', 'coords', 'courtCount', 'status'];
const DUP_RADIUS_M = 75;

const norm = (s = '') =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(park|courts?|field|the|and)\b/g, ' ').replace(/\s+/g, ' ').trim();

const meters = (a, b) => {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const BAD_CHARS = /[ÃÂâð]|\uFFFD/; // mojibake markers

function validateOne(c, errors) {
  for (const k of REQUIRED) if (c[k] == null || c[k] === '') errors.push(`${c.id || c.name}: missing "${k}"`);
  for (const s of c.sport || []) if (!SPORT_META[s]) errors.push(`${c.id}: unknown sport "${s}"`);
  if (c.district && !DISTRICT_META[c.district]) errors.push(`${c.id}: unknown district "${c.district}"`);
  for (const f of ['name', 'shortName', 'address', 'description'])
    if (c[f] && BAD_CHARS.test(c[f])) errors.push(`${c.id}: suspicious characters in ${f}`);
}

function findDuplicates(c, pool) {
  return pool.filter((o) => o.id !== c.id && (
    o.id === c.id ||
    norm(o.name) === norm(c.name) ||
    (o.coords && c.coords && meters(o.coords, c.coords) < DUP_RADIUS_M &&
      (o.sport || []).some((s) => (c.sport || []).includes(s)))
  ));
}

const candidatePath = process.argv[2];
const errors = [];

if (candidatePath) {
  const cand = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  validateOne(cand, errors);
  const dups = AUSTIN_COURTS_DATA.filter((o) => o.id === cand.id).concat(findDuplicates(cand, AUSTIN_COURTS_DATA));
  dups.forEach((d) => errors.push(`possible duplicate of existing court "${d.id}" (${d.name})`));
  console.log(errors.length ? `REJECT/REVIEW:\n - ${errors.join('\n - ')}` : 'OK: candidate looks new and valid.');
} else {
  const seen = new Set();
  for (const c of AUSTIN_COURTS_DATA) {
    if (seen.has(c.id)) errors.push(`duplicate id "${c.id}"`);
    seen.add(c.id);
    validateOne(c, errors);
  }
  AUSTIN_COURTS_DATA.forEach((c, i) =>
    findDuplicates(c, AUSTIN_COURTS_DATA.slice(i + 1)).forEach((d) =>
      errors.push(`possible duplicate: "${c.id}" vs "${d.id}"`)));
  console.log(`${AUSTIN_COURTS_DATA.length} courts audited.`);
  console.log(errors.length ? ` - ${errors.join('\n - ')}` : 'No issues found.');
}
process.exit(errors.length && !candidatePath ? 1 : 0);
