export interface LichessMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating: number;
}

export interface LichessOpening {
  eco: string;
  name: string;
}

export interface LichessData {
  moves: LichessMove[];
  opening: LichessOpening | null;
  white: number;
  draws: number;
  black: number;
}

export interface CloudEval {
  cp: number | null;
  mate: number | null;
  depth: number;
  moves: string;
}

export const fetchPosition = async (moves: string[]): Promise<LichessData> => {
  const params = new URLSearchParams({ topGames: '0', recentGames: '0' });
  if (moves.length > 0) params.set('play', moves.join(','));
  const res = await fetch(`https://explorer.lichess.ovh/masters?${params}`);
  if (!res.ok) throw new Error(`Lichess API ${res.status}`);
  return res.json();
};

export const fetchCloudEval = async (fen: string): Promise<CloudEval | null> => {
  try {
    const params = new URLSearchParams({ fen, multiPv: '1' });
    const res = await fetch(`https://lichess.org/api/cloud-eval?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const pv = data.pvs?.[0];
    if (!pv) return null;
    return {
      cp: typeof pv.cp === 'number' ? pv.cp : null,
      mate: typeof pv.mate === 'number' ? pv.mate : null,
      depth: data.depth ?? 0,
      moves: pv.moves ?? '',
    };
  } catch {
    return null;
  }
};

export const gameCount = (m: LichessMove) => m.white + m.draws + m.black;

// Win rate from white's perspective (0–100)
export const whiteWinPct = (data: { white: number; draws: number; black: number }) => {
  const total = data.white + data.draws + data.black;
  if (total === 0) return 50;
  return Math.round(((data.white + data.draws * 0.5) / total) * 100);
};

export interface OpeningDef {
  id: string;
  eco: string;
  name: string;
  description: string;
  moves: string[];
  category: string;
  tags: string[];
}

export const OPENINGS: OpeningDef[] = [
  // ── 1.e4 Openings ────────────────────────────────────────────────────────
  {
    id: 'italian',
    eco: 'C50',
    name: 'Italian Game',
    description: 'A classical opening aiming for rapid development and central control. White targets f7 with Bc4.',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'],
    category: '1. e4 Openings',
    tags: ['classical', 'attacking', 'white'],
  },
  {
    id: 'ruy-lopez',
    eco: 'C60',
    name: 'Ruy López (Spanish)',
    description: 'One of the oldest and most respected openings. White pressures the e5 pawn indirectly by attacking the knight on c6.',
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'],
    category: '1. e4 Openings',
    tags: ['classical', 'positional', 'white'],
  },
  {
    id: 'sicilian',
    eco: 'B20',
    name: 'Sicilian Defense',
    description: "Black's most popular and combative reply to 1.e4. Creates an asymmetric position with rich counterplay on the queenside.",
    moves: ['e2e4', 'c7c5'],
    category: '1. e4 Openings',
    tags: ['aggressive', 'counterplay', 'black'],
  },
  {
    id: 'sicilian-najdorf',
    eco: 'B90',
    name: 'Sicilian Najdorf',
    description: 'The most popular Sicilian variation. Black delays queenside development to create maximum flexibility and future counterattacking chances.',
    moves: ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'],
    category: '1. e4 Openings',
    tags: ['sharp', 'complex', 'black'],
  },
  {
    id: 'french',
    eco: 'C00',
    name: 'French Defense',
    description: "Black challenges the center with d5 on move 2. A solid but somewhat passive defense that often leads to strategic battles.",
    moves: ['e2e4', 'e7e6'],
    category: '1. e4 Openings',
    tags: ['solid', 'strategic', 'black'],
  },
  {
    id: 'caro-kann',
    eco: 'B10',
    name: 'Caro-Kann Defense',
    description: "A solid response to 1.e4 where Black prepares ...d5 with c6. More solid than the French with fewer pawn weaknesses.",
    moves: ['e2e4', 'c7c6'],
    category: '1. e4 Openings',
    tags: ['solid', 'endgame-oriented', 'black'],
  },
  {
    id: 'kings-gambit',
    eco: 'C30',
    name: "King's Gambit",
    description: "A dashing romantic-era opening. White sacrifices a pawn to seize the center and launch a kingside attack.",
    moves: ['e2e4', 'e7e5', 'f2f4'],
    category: '1. e4 Openings',
    tags: ['gambit', 'attacking', 'white'],
  },
  {
    id: 'scotch',
    eco: 'C44',
    name: 'Scotch Game',
    description: "White opens the center immediately with d4. A direct and active opening popularized by Kasparov at the top level.",
    moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'd2d4'],
    category: '1. e4 Openings',
    tags: ['active', 'direct', 'white'],
  },
  {
    id: 'pirc',
    eco: 'B07',
    name: 'Pirc Defense',
    description: "Black allows White to build a big center then undermines it. A hypermodern defense favored by counterattacking players.",
    moves: ['e2e4', 'd7d6', 'd2d4', 'g8f6'],
    category: '1. e4 Openings',
    tags: ['hypermodern', 'flexible', 'black'],
  },

  // ── 1.d4 Openings ────────────────────────────────────────────────────────
  {
    id: 'queens-gambit',
    eco: 'D06',
    name: "Queen's Gambit",
    description: "White offers a pawn to control the center. One of the oldest and most respected openings in chess history.",
    moves: ['d2d4', 'd7d5', 'c2c4'],
    category: '1. d4 Openings',
    tags: ['classical', 'positional', 'white'],
  },
  {
    id: 'queens-gambit-accepted',
    eco: 'D20',
    name: "Queen's Gambit Accepted",
    description: "Black accepts the gambit pawn and must carefully hold onto it or use the tempo gained for rapid development.",
    moves: ['d2d4', 'd7d5', 'c2c4', 'd5c4'],
    category: '1. d4 Openings',
    tags: ['gambit-accepted', 'dynamic', 'black'],
  },
  {
    id: 'kings-indian',
    eco: 'E60',
    name: "King's Indian Defense",
    description: "Black allows White a big center and then launches a fierce kingside counterattack. A favorite of Fischer and Kasparov.",
    moves: ['d2d4', 'g8f6', 'c2c4', 'g7g6', 'b1c3', 'f8g7'],
    category: '1. d4 Openings',
    tags: ['dynamic', 'attacking', 'black'],
  },
  {
    id: 'nimzo-indian',
    eco: 'E20',
    name: 'Nimzo-Indian Defense',
    description: "Black immediately pins the knight and aims to control the center with pieces rather than pawns.",
    moves: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'b1c3', 'f8b4'],
    category: '1. d4 Openings',
    tags: ['hypermodern', 'strategic', 'black'],
  },
  {
    id: 'queens-indian',
    eco: 'E12',
    name: "Queen's Indian Defense",
    description: "Black fianchettoes the queenside bishop to control the long diagonal and prevent White from playing e4.",
    moves: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g1f3', 'b7b6'],
    category: '1. d4 Openings',
    tags: ['solid', 'hypermodern', 'black'],
  },
  {
    id: 'dutch',
    eco: 'A80',
    name: 'Dutch Defense',
    description: "Black immediately fights for the e4 square with f5. An aggressive defense that creates unbalanced positions.",
    moves: ['d2d4', 'f7f5'],
    category: '1. d4 Openings',
    tags: ['aggressive', 'unbalanced', 'black'],
  },
  {
    id: 'london',
    eco: 'D02',
    name: 'London System',
    description: "White builds a solid pyramid with d4, Nf3 and Bf4. A reliable system that works against almost any Black setup.",
    moves: ['d2d4', 'd7d5', 'g1f3', 'g8f6', 'c1f4'],
    category: '1. d4 Openings',
    tags: ['solid', 'system', 'white'],
  },

  // ── Flank Openings ───────────────────────────────────────────────────────
  {
    id: 'english',
    eco: 'A10',
    name: 'English Opening',
    description: "White starts with a flank pawn. A flexible, hypermodern opening that can transpose into many structures.",
    moves: ['c2c4'],
    category: 'Flank Openings',
    tags: ['hypermodern', 'flexible', 'white'],
  },
  {
    id: 'reti',
    eco: 'A04',
    name: 'Réti Opening',
    description: "White develops the knight to f3 and plans to fianchetto both bishops. A modern, fluid system.",
    moves: ['g1f3', 'd7d5', 'g2g3'],
    category: 'Flank Openings',
    tags: ['hypermodern', 'strategic', 'white'],
  },
  {
    id: 'catalan',
    eco: 'E00',
    name: 'Catalan Opening',
    description: "White combines the Queen's Gambit with a kingside fianchetto. Creates long-term pressure along the g2-a8 diagonal.",
    moves: ['d2d4', 'g8f6', 'c2c4', 'e7e6', 'g2g3'],
    category: 'Flank Openings',
    tags: ['positional', 'long-term', 'white'],
  },
];
