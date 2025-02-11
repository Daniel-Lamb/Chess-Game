import { Board, Piece, Position, PieceType } from '../types/chess';

export const createInitialBoard = (): Board => {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Initialize pawns
  for (let i = 0; i < 8; i++) {
    board[1][i] = { type: 'pawn', color: 'black' };
    board[6][i] = { type: 'pawn', color: 'white' };
  }

  // Initialize other pieces
  const backRowPieces: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  
  for (let i = 0; i < 8; i++) {
    board[0][i] = { type: backRowPieces[i], color: 'black' };
    board[7][i] = { type: backRowPieces[i], color: 'white' };
  }

  return board;
};

export const isValidMove = (
  board: Board,
  from: Position,
  to: Position,
  currentPlayer: 'white' | 'black'
): boolean => {
  const piece = board[from.row][from.col];
  if (!piece || piece.color !== currentPlayer) return false;
  
  // Basic validation: can't capture own pieces
  const targetPiece = board[to.row][to.col];
  if (targetPiece && targetPiece.color === currentPlayer) return false;

  // Implement piece-specific movement rules here
  // This is a simplified version - you would want to add full chess rules
  const rowDiff = Math.abs(to.row - from.row);
  const colDiff = Math.abs(to.col - from.col);

  switch (piece.type) {
    case 'pawn':
      const direction = piece.color === 'white' ? -1 : 1;
      const startRow = piece.color === 'white' ? 6 : 1;
      
      // Moving forward
      if (from.col === to.col && !targetPiece) {
        if (from.row + direction === to.row) return true;
        if (from.row === startRow && from.row + 2 * direction === to.row) return true;
      }
      
      // Capturing
      if (rowDiff === 1 && colDiff === 1 && targetPiece) return true;
      
      return false;

    case 'rook':
      return (from.row === to.row || from.col === to.col);

    case 'knight':
      return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);

    case 'bishop':
      return rowDiff === colDiff;

    case 'queen':
      return rowDiff === colDiff || from.row === to.row || from.col === to.col;

    case 'king':
      return rowDiff <= 1 && colDiff <= 1;

    default:
      return false;
  }
};