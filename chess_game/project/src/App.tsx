import React, { useState } from 'react';
import { Board, Position } from './types/chess';
import { createInitialBoard, isValidMove } from './utils/chessLogic';
import ChessBoard from './components/ChessBoard';

function App() {
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black'>('white');
  const [gameStatus, setGameStatus] = useState<string>('');

  const handleSquareClick = (position: Position) => {
    if (!selectedPosition) {
      const piece = board[position.row][position.col];
      if (piece && piece.color === currentPlayer) {
        setSelectedPosition(position);
      }
    } else {
      if (isValidMove(board, selectedPosition, position, currentPlayer)) {
        const newBoard = [...board.map(row => [...row])];
        newBoard[position.row][position.col] = board[selectedPosition.row][selectedPosition.col];
        newBoard[selectedPosition.row][selectedPosition.col] = null;
        
        setBoard(newBoard);
        setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
        
        // Check if king is captured
        const targetPiece = board[position.row][position.col];
        if (targetPiece?.type === 'king') {
          setGameStatus(`${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} wins!`);
        }
      }
      setSelectedPosition(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
          Chess Game
        </h1>
        
        <div className="mb-4 text-center">
          <p className="text-lg font-semibold text-gray-700">
            Current Player: {currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}
          </p>
          {gameStatus && (
            <p className="text-xl font-bold text-green-600 mt-2">
              {gameStatus}
            </p>
          )}
        </div>

        <ChessBoard
          board={board}
          selectedPosition={selectedPosition}
          onSquareClick={handleSquareClick}
        />
      </div>
    </div>
  );
}

export default App;