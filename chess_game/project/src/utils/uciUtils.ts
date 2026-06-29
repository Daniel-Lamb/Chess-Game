import { Position } from '../types/chess';

const FILES = 'abcdefgh';

export const posToSquare = (pos: Position): string =>
  FILES[pos.col] + (8 - pos.row);

export const squareToPos = (sq: string): Position => ({
  col: FILES.indexOf(sq[0]),
  row: 8 - parseInt(sq[1], 10),
});

export const moveToUci = (from: Position, to: Position, promotion?: string): string =>
  posToSquare(from) + posToSquare(to) + (promotion ?? '');

export const uciToMove = (uci: string) => ({
  from: squareToPos(uci.slice(0, 2)),
  to: squareToPos(uci.slice(2, 4)),
  promotion: uci.length > 4 ? uci[4] : undefined,
});
