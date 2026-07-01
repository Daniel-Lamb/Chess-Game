import { Board, CastlingRights, Position } from '../types/chess';

const PIECE_FEN: Record<string, string> = {
  'white-king': 'K', 'white-queen': 'Q', 'white-rook': 'R',
  'white-bishop': 'B', 'white-knight': 'N', 'white-pawn': 'P',
  'black-king': 'k', 'black-queen': 'q', 'black-rook': 'r',
  'black-bishop': 'b', 'black-knight': 'n', 'black-pawn': 'p',
};

export const boardToFen = (
  board: Board,
  currentPlayer: 'white' | 'black',
  castlingRights: CastlingRights,
  enPassant: Position | null,
): string => {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = '';
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) {
        empty++;
      } else {
        if (empty) { row += empty; empty = 0; }
        row += PIECE_FEN[`${piece.color}-${piece.type}`];
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }

  const side = currentPlayer === 'white' ? 'w' : 'b';

  let castling = '';
  if (castlingRights.whiteKingside) castling += 'K';
  if (castlingRights.whiteQueenside) castling += 'Q';
  if (castlingRights.blackKingside) castling += 'k';
  if (castlingRights.blackQueenside) castling += 'q';
  if (!castling) castling = '-';

  let ep = '-';
  if (enPassant) {
    ep = 'abcdefgh'[enPassant.col] + (8 - enPassant.row);
  }

  return `${rows.join('/')} ${side} ${castling} ${ep} 0 1`;
};
