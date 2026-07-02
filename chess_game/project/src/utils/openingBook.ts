import { OPENINGS } from '../data/openings';

export const MAX_BOOK_PLIES = 20; // 10 full moves per side

export interface OpeningName {
  eco: string;
  name: string;
}

export interface BookMove {
  uci: string;
  san: string;
  lines: number; // number of named opening lines through this move
}

const prefixMatches = (entryUci: string, key: string): boolean =>
  key === '' || entryUci === key || entryUci.startsWith(key + ' ');

// Longest-prefix opening name for the given position (exact match wins naturally)
export const lookupOpening = (history: string[]): OpeningName | null => {
  const key = history.join(' ');
  if (key === '') return null;

  let best: OpeningName | null = null;
  let bestLen = -1;
  for (const [eco, name, uci] of OPENINGS) {
    if (uci.length > key.length) continue;
    if (uci === key || (key.startsWith(uci) && key[uci.length] === ' ')) {
      if (uci.length > bestLen) {
        bestLen = uci.length;
        best = { eco, name };
      }
    }
  }
  return best;
};

// All book continuations from the given position, most popular first
export const getBookMoves = (history: string[]): BookMove[] => {
  if (history.length >= MAX_BOOK_PLIES) return [];
  const key = history.join(' ');
  const ply = history.length;

  const agg = new Map<string, BookMove>();
  for (const entry of OPENINGS) {
    const uciStr = entry[2];
    if (!prefixMatches(uciStr, key)) continue;
    const ucis = uciStr.split(' ');
    if (ucis.length <= ply) continue; // entry ends at this position
    const nextUci = ucis[ply];
    const existing = agg.get(nextUci);
    if (existing) {
      existing.lines++;
    } else {
      agg.set(nextUci, { uci: nextUci, san: entry[3].split(' ')[ply], lines: 1 });
    }
  }
  return [...agg.values()].sort((a, b) => b.lines - a.lines);
};
