import React from 'react';
import { Board, Position } from '../types/chess';

export interface MovePreview {
  to: Position;
  color: string;
  san: string;
}

interface ChessBoardProps {
  board: Board;
  selectedPosition: Position | null;
  validMoves: Position[];
  onSquareClick: (position: Position) => void;
  flipped?: boolean;
  movePreviews?: MovePreview[];
}

const PIECE_SYMBOLS: Record<string, string> = {
  'white-king': '♔', 'white-queen': '♕', 'white-rook': '♖',
  'white-bishop': '♗', 'white-knight': '♘', 'white-pawn': '♙',
  'black-king': '♚', 'black-queen': '♛', 'black-rook': '♜',
  'black-bishop': '♝', 'black-knight': '♞', 'black-pawn': '♟',
};

const SQ = 72;

const ChessBoard: React.FC<ChessBoardProps> = ({
  board, selectedPosition, validMoves, onSquareClick, flipped = false, movePreviews,
}) => {
  const rows = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const rankLabels = flipped ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
  const fileLabels = flipped ? ['H','G','F','E','D','C','B','A'] : ['A','B','C','D','E','F','G','H'];

  const isSelected = (r: number, c: number) =>
    selectedPosition?.row === r && selectedPosition?.col === c;

  const isTarget = (r: number, c: number) =>
    validMoves.some(m => m.row === r && m.col === c);

  return (
    <div className="flex select-none">
      {/* Rank labels */}
      <div className="flex flex-col pr-1.5">
        {rankLabels.map((rank, i) => (
          <div
            key={i}
            className="flex items-center justify-center text-gray-400 text-xs font-mono"
            style={{ width: 14, height: SQ }}
          >
            {rank}
          </div>
        ))}
      </div>

      <div>
        {/* Board grid */}
        <div
          className="grid grid-cols-8 border-2 border-gray-600 shadow-2xl"
          style={{ width: SQ * 8, height: SQ * 8 }}
        >
          {rows.map(rowIdx =>
            cols.map(colIdx => {
              const piece = board[rowIdx][colIdx];
              const light = (rowIdx + colIdx) % 2 === 0;
              const selected = isSelected(rowIdx, colIdx);
              const target = isTarget(rowIdx, colIdx);
              const capture = target && piece !== null;

              let bg: string;
              if (selected) {
                bg = '#f6f669';
              } else if (capture) {
                bg = light ? '#e8685a' : '#c84b3c';
              } else if (target) {
                bg = light ? '#cdd26a' : '#aaa23a';
              } else {
                bg = light ? '#F0D9B5' : '#B58863';
              }

              const symbol = piece ? PIECE_SYMBOLS[`${piece.color}-${piece.type}`] : null;
              const preview = movePreviews?.find(p => p.to.row === rowIdx && p.to.col === colIdx);

              return (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  style={{ width: SQ, height: SQ, backgroundColor: bg }}
                  className="flex items-center justify-center cursor-pointer relative"
                  onClick={() => onSquareClick({ row: rowIdx, col: colIdx })}
                >
                  {target && !capture && (
                    <div
                      className="absolute rounded-full pointer-events-none"
                      style={{ width: SQ * 0.31, height: SQ * 0.31, backgroundColor: 'rgba(0,0,0,0.18)' }}
                    />
                  )}
                  {preview && (
                    <div
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        width: SQ * 0.38,
                        height: SQ * 0.38,
                        backgroundColor: preview.color,
                        opacity: 0.72,
                        boxShadow: `0 0 6px 2px ${preview.color}`,
                      }}
                    />
                  )}
                  {symbol && (
                    <span
                      className="leading-none"
                      style={{
                        fontSize: SQ * 0.72,
                        color: piece!.color === 'white' ? '#fff' : '#1a1a1a',
                        textShadow:
                          piece!.color === 'white'
                            ? '0 0 3px #000, 0 1px 3px #000'
                            : '0 1px 2px rgba(255,255,255,0.25)',
                      }}
                    >
                      {symbol}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* File labels */}
        <div className="flex pt-1">
          {fileLabels.map((file, i) => (
            <div
              key={i}
              className="text-gray-400 text-xs font-mono text-center"
              style={{ width: SQ }}
            >
              {file}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChessBoard;
