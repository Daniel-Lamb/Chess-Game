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

export const fetchPosition = async (moves: string[]): Promise<LichessData> => {
  const params = new URLSearchParams({ topGames: '0', recentGames: '0' });
  if (moves.length > 0) params.set('play', moves.join(','));
  const res = await fetch(`https://explorer.lichess.ovh/masters?${params}`, {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Lichess API ${res.status}`);
  return res.json();
};

export const gameCount = (m: LichessMove) => m.white + m.draws + m.black;
