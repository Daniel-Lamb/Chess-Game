import { Board, Piece, Position, PieceType, PieceColor } from '../types/chess';

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

const getPieceMoves = (board: Board, from: Position, piece: Piece): Position[] => {
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
      if (inBounds(row + dir, col) && !board[row + dir][col]) {
        moves.push({ row: row + dir, col });
        if (row === startRow && !board[row + 2 * dir][col])
          moves.push({ row: row + 2 * dir, col });
      }
      for (const dc of [-1, 1]) {
        if (inBounds(row + dir, col + dc)) {
          const t = board[row + dir][col + dc];
          if (t && t.color !== color) moves.push({ row: row + dir, col: col + dc });
        }
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
    case 'king':
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
        step(row + dr, col + dc);
      break;
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

export const isSquareAttacked = (board: Board, pos: Position, byColor: PieceColor): boolean => {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.color !== byColor) continue;
      if (getPieceMoves(board, { row: r, col: c }, p).some(m => m.row === pos.row && m.col === pos.col))
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

export const getValidMoves = (board: Board, from: Position, color: PieceColor): Position[] => {
  const piece = board[from.row][from.col];
  if (!piece || piece.color !== color) return [];
  return getPieceMoves(board, from, piece).filter(to => !isInCheck(applyMove(board, from, to), color));
};

export const isValidMove = (board: Board, from: Position, to: Position, color: PieceColor): boolean =>
  getValidMoves(board, from, color).some(m => m.row === to.row && m.col === to.col);

export const hasAnyValidMoves = (board: Board, color: PieceColor): boolean => {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === color && getValidMoves(board, { row: r, col: c }, color).length > 0)
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
