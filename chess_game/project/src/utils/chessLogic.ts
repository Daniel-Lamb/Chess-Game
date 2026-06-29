import { Board, Piece, Position, PieceType, PieceColor, CastlingRights } from '../types/chess';

export const DEFAULT_CASTLING_RIGHTS: CastlingRights = {
  whiteKingside: true,
  whiteQueenside: true,
  blackKingside: true,
  blackQueenside: true,
};

const NO_CASTLING: CastlingRights = {
  whiteKingside: false,
  whiteQueenside: false,
  blackKingside: false,
  blackQueenside: false,
};

export const createInitialBoard = (): Board => {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));

  for (let i = 0; i < 8; i++) {
    board[1][i] = { type: 'pawn', color: 'black' };
    board[6][i] = { type: 'pawn', color: 'white' };
  }

  const backRow: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let i = 0; i < 8; i++) {
    board[0][i] = { type: backRow[i], color: 'black' };
    board[7][i] = { type: backRow[i], color: 'white' };
  }

  return board;
};

const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

// Generates candidate moves for a piece. enPassantTarget and castlingRights
// are used for special moves; pass null / NO_CASTLING when not needed.
const getPieceMoves = (
  board: Board,
  from: Position,
  piece: Piece,
  enPassantTarget: Position | null,
  castlingRights: CastlingRights,
): Position[] => {
  const moves: Position[] = [];
  const { row, col } = from;
  const { type, color } = piece;

  const slide = (dr: number, dc: number) => {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (target) {
        if (target.color !== color) moves.push({ row: r, col: c });
        break;
      }
      moves.push({ row: r, col: c });
      r += dr; c += dc;
    }
  };

  const step = (r: number, c: number) => {
    if (!inBounds(r, c)) return;
    const target = board[r][c];
    if (!target || target.color !== color) moves.push({ row: r, col: c });
  };

  switch (type) {
    case 'pawn': {
      const dir = color === 'white' ? -1 : 1;
      const startRow = color === 'white' ? 6 : 1;
      // Forward one
      if (inBounds(row + dir, col) && !board[row + dir][col]) {
        moves.push({ row: row + dir, col });
        // Forward two from starting rank
        if (row === startRow && !board[row + 2 * dir][col])
          moves.push({ row: row + 2 * dir, col });
      }
      // Diagonal captures
      for (const dc of [-1, 1]) {
        if (inBounds(row + dir, col + dc)) {
          const t = board[row + dir][col + dc];
          if (t && t.color !== color) moves.push({ row: row + dir, col: col + dc });
        }
      }
      // En passant capture
      if (enPassantTarget &&
          row + dir === enPassantTarget.row &&
          Math.abs(col - enPassantTarget.col) === 1) {
        moves.push({ row: enPassantTarget.row, col: enPassantTarget.col });
      }
      break;
    }
    case 'rook':
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) slide(dr, dc);
      break;
    case 'knight':
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
        step(row + dr, col + dc);
      break;
    case 'bishop':
      for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) slide(dr, dc);
      break;
    case 'queen':
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) slide(dr, dc);
      break;
    case 'king': {
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
        step(row + dr, col + dc);

      // Castling — only when king is on its starting square
      const homeRow = color === 'white' ? 7 : 0;
      if (row === homeRow && col === 4) {
        const canKS = color === 'white' ? castlingRights.whiteKingside : castlingRights.blackKingside;
        const canQS = color === 'white' ? castlingRights.whiteQueenside : castlingRights.blackQueenside;

        // Kingside: f and g files must be empty; rook must still be on h-file
        if (canKS &&
            !board[homeRow][5] && !board[homeRow][6] &&
            board[homeRow][7]?.type === 'rook' && board[homeRow][7]?.color === color) {
          moves.push({ row: homeRow, col: 6 });
        }

        // Queenside: b, c, d files must be empty; rook must still be on a-file
        if (canQS &&
            !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3] &&
            board[homeRow][0]?.type === 'rook' && board[homeRow][0]?.color === color) {
          moves.push({ row: homeRow, col: 2 });
        }
      }
      break;
    }
  }

  return moves;
};

export const findKing = (board: Board, color: PieceColor): Position | null => {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === 'king' && board[r][c]?.color === color)
        return { row: r, col: c };
  return null;
};

// Whether a square is attacked by any piece of byColor.
// Uses pawn control squares (always diagonal) rather than pawn move squares,
// so this is correct for castling through-check detection too.
export const isSquareAttacked = (board: Board, pos: Position, byColor: PieceColor): boolean => {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== byColor) continue;

      if (p.type === 'pawn') {
        // Pawns always control both forward diagonals regardless of capture availability
        const dir = p.color === 'white' ? -1 : 1;
        if (r + dir === pos.row && (c - 1 === pos.col || c + 1 === pos.col)) return true;
        continue;
      }

      if (getPieceMoves(board, { row: r, col: c }, p, null, NO_CASTLING)
          .some(m => m.row === pos.row && m.col === pos.col))
        return true;
    }
  }
  return false;
};

export const isInCheck = (board: Board, color: PieceColor): boolean => {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  return isSquareAttacked(board, kingPos, color === 'white' ? 'black' : 'white');
};

const applyMove = (board: Board, from: Position, to: Position): Board => {
  const b = board.map(row => [...row]);
  b[to.row][to.col] = b[from.row][from.col];
  b[from.row][from.col] = null;
  return b;
};

export const getValidMoves = (
  board: Board,
  from: Position,
  color: PieceColor,
  enPassantTarget: Position | null,
  castlingRights: CastlingRights,
): Position[] => {
  const piece = board[from.row][from.col];
  if (!piece || piece.color !== color) return [];

  const raw = getPieceMoves(board, from, piece, enPassantTarget, castlingRights);

  return raw.filter(to => {
    // Castling: king cannot be in check, cannot pass through an attacked square
    if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) {
      if (isInCheck(board, color)) return false;
      const midCol = from.col + Math.sign(to.col - from.col);
      if (isInCheck(applyMove(board, from, { row: from.row, col: midCol }), color)) return false;
    }

    // En passant: remove the captured pawn before checking for self-check
    if (piece.type === 'pawn' &&
        enPassantTarget &&
        to.row === enPassantTarget.row &&
        to.col === enPassantTarget.col) {
      const b = applyMove(board, from, to);
      b[from.row][to.col] = null; // remove the skipped pawn
      return !isInCheck(b, color);
    }

    return !isInCheck(applyMove(board, from, to), color);
  });
};

export const isValidMove = (
  board: Board,
  from: Position,
  to: Position,
  color: PieceColor,
  enPassantTarget: Position | null,
  castlingRights: CastlingRights,
): boolean =>
  getValidMoves(board, from, color, enPassantTarget, castlingRights)
    .some(m => m.row === to.row && m.col === to.col);

export const hasAnyValidMoves = (
  board: Board,
  color: PieceColor,
  enPassantTarget: Position | null,
  castlingRights: CastlingRights,
): boolean => {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === color &&
          getValidMoves(board, { row: r, col: c }, color, enPassantTarget, castlingRights).length > 0)
        return true;
  return false;
};

export const promotePawn = (board: Board, pos: Position): Board => {
  const piece = board[pos.row][pos.col];
  if (piece?.type === 'pawn' && (pos.row === 0 || pos.row === 7)) {
    const b = board.map(row => [...row]);
    b[pos.row][pos.col] = { type: 'queen', color: piece.color };
    return b;
  }
  return board;
};

// Returns the en passant target square after a double pawn push, or null.
export const getEnPassantTarget = (
  from: Position,
  to: Position,
  piece: Piece,
): Position | null => {
  if (piece.type !== 'pawn' || Math.abs(to.row - from.row) !== 2) return null;
  return { row: (from.row + to.row) / 2, col: from.col };
};

// Updates castling rights after a move. Revokes rights when the king or a
// rook moves, and also when a rook is captured on its starting square.
export const updateCastlingRights = (
  rights: CastlingRights,
  from: Position,
  to: Position,
  piece: Piece,
): CastlingRights => {
  const r = { ...rights };

  if (piece.type === 'king') {
    if (piece.color === 'white') { r.whiteKingside = false; r.whiteQueenside = false; }
    else { r.blackKingside = false; r.blackQueenside = false; }
  }

  if (piece.type === 'rook') {
    if (from.row === 7 && from.col === 0) r.whiteQueenside = false;
    if (from.row === 7 && from.col === 7) r.whiteKingside = false;
    if (from.row === 0 && from.col === 0) r.blackQueenside = false;
    if (from.row === 0 && from.col === 7) r.blackKingside = false;
  }

  // Rook captured on its starting square
  if (to.row === 7 && to.col === 0) r.whiteQueenside = false;
  if (to.row === 7 && to.col === 7) r.whiteKingside = false;
  if (to.row === 0 && to.col === 0) r.blackQueenside = false;
  if (to.row === 0 && to.col === 7) r.blackKingside = false;

  return r;
};
