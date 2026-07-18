import React, { useMemo, useState } from 'react';
import {
  FaChessBishop, FaChessKnight, FaChessQueen, FaChessKing,
  FaChessPawn, FaChessRook,
} from 'react-icons/fa';
import { OPENINGS, OpeningEntry } from '../data/openings';
import { applyUciMoves } from '../utils/moveExec';
import { uciToMove } from '../utils/uciUtils';
import ChessBoard, { MovePreview } from './ChessBoard';
import InteractiveSelector, { SelectorOption } from './ui/interactive-selector';

// ── The 10 openings to learn ──────────────────────────────────────────────────
// `prefix` must match opening names in the lichess database exactly.
interface LearnOpening {
  prefix: string;
  eco: string;
  description: string;
  gradient: string;
  glyph: string;
  icon: React.ReactNode;
}

const LEARN_OPENINGS: LearnOpening[] = [
  {
    prefix: 'Ruy Lopez', eco: 'C60',
    description: 'The Spanish — pressure on e5',
    gradient: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 55%, #f59e0b 130%)',
    glyph: '♝', icon: <FaChessBishop size={20} className="text-white" />,
  },
  {
    prefix: 'Italian Game', eco: 'C50',
    description: 'Classical piece play on c4',
    gradient: 'linear-gradient(135deg, #14532d 0%, #16a34a 60%, #bef264 140%)',
    glyph: '♗', icon: <FaChessBishop size={20} className="text-white" />,
  },
  {
    prefix: 'Sicilian Defense', eco: 'B20',
    description: 'Sharpest reply to 1.e4',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 60%, #a78bfa 140%)',
    glyph: '♛', icon: <FaChessQueen size={20} className="text-white" />,
  },
  {
    prefix: 'French Defense', eco: 'C00',
    description: 'Solid pawn chain with ...e6',
    gradient: 'linear-gradient(135deg, #164e63 0%, #0891b2 60%, #67e8f9 140%)',
    glyph: '♟', icon: <FaChessPawn size={20} className="text-white" />,
  },
  {
    prefix: 'Caro-Kann Defense', eco: 'B10',
    description: 'Rock-solid ...c6 and ...d5',
    gradient: 'linear-gradient(135deg, #3f2c22 0%, #92400e 60%, #fbbf24 140%)',
    glyph: '♜', icon: <FaChessRook size={20} className="text-white" />,
  },
  {
    prefix: "Queen's Gambit", eco: 'D06',
    description: 'Fight for the center with c4',
    gradient: 'linear-gradient(135deg, #500724 0%, #be185d 60%, #f9a8d4 140%)',
    glyph: '♕', icon: <FaChessQueen size={20} className="text-white" />,
  },
  {
    prefix: "King's Indian Defense", eco: 'E60',
    description: 'Hypermodern kingside storm',
    gradient: 'linear-gradient(135deg, #431407 0%, #ea580c 60%, #fde047 140%)',
    glyph: '♚', icon: <FaChessKing size={20} className="text-white" />,
  },
  {
    prefix: 'Nimzo-Indian Defense', eco: 'E20',
    description: 'Pin the knight, own the center',
    gradient: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #93c5fd 140%)',
    glyph: '♞', icon: <FaChessKnight size={20} className="text-white" />,
  },
  {
    prefix: 'English Opening', eco: 'A10',
    description: 'Flexible flank play with 1.c4',
    gradient: 'linear-gradient(135deg, #14432a 0%, #059669 60%, #6ee7b7 140%)',
    glyph: '♙', icon: <FaChessPawn size={20} className="text-white" />,
  },
  {
    prefix: 'Scotch Game', eco: 'C44',
    description: 'Open the center with 3.d4',
    gradient: 'linear-gradient(135deg, #3b0764 0%, #9333ea 60%, #e9d5ff 140%)',
    glyph: '♘', icon: <FaChessKnight size={20} className="text-white" />,
  },
];

// ── Variation lookup from the opening database ────────────────────────────────
interface Variation {
  eco: string;
  name: string;
  label: string;   // name with the opening prefix stripped
  ucis: string[];
  sans: string[];
}

const getVariations = (prefix: string, max = 5): Variation[] => {
  const candidates = OPENINGS.filter(([, name]) =>
    name === prefix || name.startsWith(prefix + ':') || name.startsWith(prefix + ' ')
  );
  // Prefer the longest (most instructive) line for each distinct name
  const sorted = [...candidates].sort((a, b) => b[2].length - a[2].length);
  const seen = new Set<string>();
  const picked: OpeningEntry[] = [];
  for (const e of sorted) {
    if (seen.has(e[1])) continue;
    seen.add(e[1]);
    picked.push(e);
    if (picked.length === max) break;
  }
  return picked
    .map(([eco, name, uci, san]) => ({
      eco,
      name,
      label: name === prefix
        ? 'Main line'
        : name.replace(prefix, '').replace(/^[:\s]+/, ''),
      ucis: uci.split(' '),
      sans: san.split(' '),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

// ── Component ─────────────────────────────────────────────────────────────────

const LearnOpenings: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [variationIdx, setVariationIdx] = useState(0);
  const [step, setStep] = useState(0);

  const opening = LEARN_OPENINGS[activeIndex];
  const variations = useMemo(() => getVariations(opening.prefix), [opening.prefix]);
  const variation = variations[variationIdx] ?? variations[0];

  const board = useMemo(
    () => applyUciMoves(variation.ucis.slice(0, step)),
    [variation, step],
  );

  // Highlight the last played move's destination
  const previews: MovePreview[] = step > 0
    ? [{
        to: uciToMove(variation.ucis[step - 1]).to,
        color: '#eab308',
        san: variation.sans[step - 1],
      }]
    : [];

  const selectOpening = (i: number) => {
    setActiveIndex(i);
    setVariationIdx(0);
    setStep(0);
  };

  const selectVariation = (i: number) => {
    setVariationIdx(i);
    setStep(0);
  };

  const total = variation.ucis.length;

  const selectorOptions: SelectorOption[] = LEARN_OPENINGS.map(o => ({
    title: o.prefix,
    description: `${o.eco} · ${o.description}`,
    gradient: o.gradient,
    glyph: o.glyph,
    icon: o.icon,
  }));

  // SAN move pairs for the move list
  const movePairs = variation.sans.reduce<{ san: string; ply: number }[][]>((acc, san, i) => {
    if (i % 2 === 0) acc.push([{ san, ply: i + 1 }]);
    else acc[acc.length - 1].push({ san, ply: i + 1 });
    return acc;
  }, []);

  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: 900 }}>
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">Learn the Openings</h2>
        <p className="text-gray-400 text-sm">
          Pick an opening, choose a variation, and step through the first 10 moves
        </p>
      </div>

      <InteractiveSelector
        options={selectorOptions}
        activeIndex={activeIndex}
        onSelect={selectOpening}
        height={280}
      />

      <div className="flex gap-5 items-start">
        <ChessBoard
          board={board}
          selectedPosition={null}
          validMoves={[]}
          onSquareClick={() => {}}
          movePreviews={previews}
        />

        {/* Side panel */}
        <div className="w-64 flex flex-col gap-3 shrink-0">

          {/* Current line */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Line</div>
            <div>
              <span className="text-yellow-400 font-bold text-xs">{variation.eco} · </span>
              <span className="text-white text-sm font-semibold leading-snug">{variation.name}</span>
            </div>
          </div>

          {/* Variations */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Variations</div>
            <div className="flex flex-col gap-1">
              {variations.map((v, i) => (
                <button
                  key={v.name}
                  onClick={() => selectVariation(i)}
                  className={`text-left text-xs rounded px-2 py-1.5 transition-colors leading-snug ${
                    i === variationIdx
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span className="font-mono opacity-60 mr-1">{v.eco}</span>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Playback controls */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-center gap-1.5">
              {([
                ['⏮', () => setStep(0), step === 0],
                ['◀', () => setStep(s => Math.max(0, s - 1)), step === 0],
                ['▶', () => setStep(s => Math.min(total, s + 1)), step === total],
                ['⏭', () => setStep(total), step === total],
              ] as const).map(([label, fn, disabled], i) => (
                <button
                  key={i}
                  onClick={fn}
                  disabled={disabled}
                  className="w-10 py-1.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:hover:bg-gray-700 text-white text-sm"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-center text-gray-400 text-xs mt-2">
              Move {step} of {total}
            </p>
          </div>

          {/* Move list — click any move to jump there */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Moves</div>
            <div className="font-mono text-xs space-y-0.5 max-h-44 overflow-y-auto">
              {movePairs.map((pair, i) => (
                <div key={i} className="flex gap-1">
                  <span className="text-gray-600 w-5 shrink-0">{i + 1}.</span>
                  {pair.map(m => (
                    <button
                      key={m.ply}
                      onClick={() => setStep(m.ply)}
                      className={`px-1 rounded ${
                        m.ply === step
                          ? 'bg-yellow-600/60 text-white font-bold'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {m.san}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearnOpenings;
