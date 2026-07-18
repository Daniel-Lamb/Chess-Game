import { Board, Position, CastlingRights } from '../types/chess';
import {
  createInitialBoard,
  promotePawn,
  getEnPassantTarget,
  updateCastlingRights,
  DEFAULT_CASTLING_RIGHTS,
} from './chessLogic';
import { uciToMove } from './uciUtils';

// Applies a move (+ castling / en passant / promotion side effects) and returns updated state.
export const doMove = (
  board: Board,
  from: Position,
  to: Position,
  castling: CastlingRights,
  enPassant: Position | null,
  player: 'white' | 'black',
) => {
  const piece = board[from.row][from.col]!;
  let nb = board.map(r => [...r]);
  nb[to.row][to.col] = piece;
  nb[from.row][from.col] = null;

  if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) {
    const r = from.row;
    if (to.col === 6) { nb[r][5] = nb[r][7]; nb[r][7] = null; }
    else              { nb[r][3] = nb[r][0]; nb[r][0] = null; }
  }

  if (piece.type === 'pawn' && enPassant &&
      to.row === enPassant.row && to.col === enPassant.col) {
    nb[from.row][to.col] = null;
  }

  nb = promotePawn(nb, to);

  return {
    board: nb,
    castling: updateCastlingRights(castling, from, to, piece),
    enPassant: getEnPassantTarget(from, to, piece),
    player: (player === 'white' ? 'black' : 'white') as 'white' | 'black',
  };
};

// Plays a sequence of UCI moves from the starting position and returns the board.
export const applyUciMoves = (ucis: string[]): Board => {
  let board = createInitialBoard();
  let castling = DEFAULT_CASTLING_RIGHTS;
  let enPassant: Position | null = null;
  let player: 'white' | 'black' = 'white';
  for (const uci of ucis) {
    const { from, to } = uciToMove(uci);
    const r = doMove(board, from, to, castling, enPassant, player);
    board = r.board;
    castling = r.castling;
    enPassant = r.enPassant;
    player = r.player;
  }
  return board;
};
