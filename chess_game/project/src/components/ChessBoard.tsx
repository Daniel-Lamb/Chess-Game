import React from 'react';
import { Board, Position } from '../types/chess';

interface ChessBoardProps {
  board: Board;
  selectedPosition: Position | null;
  onSquareClick: (position: Position) => void;
}

const ChessBoard: React.FC<ChessBoardProps> = ({ board, selectedPosition, onSquareClick }) => {
  const getPieceSymbol = (piece: any) => {
    if (!piece) return null;
    const symbols: Record<string, string> = {
      'white-king': '♔',
      'white-queen': '♕',
      'white-rook': '♖',
      'white-bishop': '♗',
      'white-knight': '♘',
      'white-pawn': '♙',
      'black-king': '♚',
      'black-queen': '♛',
      'black-rook': '♜',
      'black-bishop': '♝',
      'black-knight': '♞',
      'black-pawn': '♟',
    };
    return symbols[`${piece.color}-${piece.type}`];
  };

  const isSelected = (row: number, col: number) => {
    return selectedPosition?.row === row && selectedPosition?.col === col;
  };

  return (
    <div className="grid grid-cols-8 gap-0 border-4 border-gray-800 w-[640px] shadow-2xl">
      {board.map((row, rowIndex) =>
        row.map((piece, colIndex) => {
          const isLight = (rowIndex + colIndex) % 2 === 0;
          const bgColor = isLight ? 'bg-[#E9DAB2]' : 'bg-[#779556]';
          const selectedClass = isSelected(rowIndex, colIndex) ? 'ring-4 ring-blue-500' : '';
          const pieceColor = piece?.color === 'white' ? 'text-white' : 'text-black';

          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`
                ${bgColor} ${selectedClass}
                w-20 h-20 flex items-center justify-center
                cursor-pointer transition-all duration-200
                hover:shadow-inner
              `}
              onClick={() => onSquareClick({ row: rowIndex, col: colIndex })}
            >
              <span className={`text-6xl select-none ${pieceColor} font-chess transform transition-transform hover:scale-110`}>
                {getPieceSymbol(piece)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
};

export default ChessBoard;