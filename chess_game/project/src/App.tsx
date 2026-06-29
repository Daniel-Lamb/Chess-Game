import React, { useState, useCallback } from 'react';
import { Board, Position } from './types/chess';
import {
  createInitialBoard,
  isValidMove,
  getValidMoves,
  isInCheck,
  hasAnyValidMoves,
  promotePawn,
} from './utils/chessLogic';
import ChessBoard from './components/ChessBoard';

type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate';

function App() {
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black'>('white');
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [winner, setWinner] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [moveCount, setMoveCount] = useState(0);

  const resetGame = () => {
    setBoard(createInitialBoard());
    setSelectedPosition(null);
    setCurrentPlayer('white');
    setGameStatus('playing');
    setWinner(null);
    setValidMoves([]);
    setMoveCount(0);
  };

  const handleSquareClick = useCallback(
    (position: Position) => {
      if (gameStatus === 'checkmate' || gameStatus === 'stalemate') return;

      if (!selectedPosition) {
        const piece = board[position.row][position.col];
        if (piece && piece.color === currentPlayer) {
          setSelectedPosition(position);
          setValidMoves(getValidMoves(board, position, currentPlayer));
        }
        return;
      }

      // Deselect on same square
      if (selectedPosition.row === position.row && selectedPosition.col === position.col) {
        setSelectedPosition(null);
        setValidMoves([]);
        return;
      }

      // Switch selection to another own piece
      const clickedPiece = board[position.row][position.col];
      if (clickedPiece && clickedPiece.color === currentPlayer) {
        setSelectedPosition(position);
        setValidMoves(getValidMoves(board, position, currentPlayer));
        return;
      }

      // Attempt move
      if (isValidMove(board, selectedPosition, position, currentPlayer)) {
        let newBoard = board.map(row => [...row]);
        newBoard[position.row][position.col] = newBoard[selectedPosition.row][selectedPosition.col];
        newBoard[selectedPosition.row][selectedPosition.col] = null;
        newBoard = promotePawn(newBoard, position);

        const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';
        const inCheck = isInCheck(newBoard, nextPlayer);
        const hasMoves = hasAnyValidMoves(newBoard, nextPlayer);

        let newStatus: GameStatus;
        if (!hasMoves) {
          newStatus = inCheck ? 'checkmate' : 'stalemate';
          if (newStatus === 'checkmate')
            setWinner(currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1));
        } else {
          newStatus = inCheck ? 'check' : 'playing';
        }

        setBoard(newBoard);
        setCurrentPlayer(nextPlayer);
        setGameStatus(newStatus);
        setMoveCount(n => n + 1);
      }

      setSelectedPosition(null);
      setValidMoves([]);
    },
    [board, selectedPosition, currentPlayer, gameStatus]
  );

  const statusMessage = () => {
    if (gameStatus === 'checkmate') return `Checkmate — ${winner} wins!`;
    if (gameStatus === 'stalemate') return 'Stalemate — Draw!';
    if (gameStatus === 'check') return `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} is in check!`;
    return null;
  };

  const msg = statusMessage();

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-900 px-8 pt-8 pb-6 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold mb-4 text-center text-white tracking-widest uppercase">
          Chess
        </h1>

        <div className="mb-4 text-center space-y-1 min-h-[52px]">
          {(gameStatus === 'playing' || gameStatus === 'check') && (
            <p className="text-base font-semibold text-gray-300">
              {currentPlayer === 'white' ? '⬜' : '⬛'}{' '}
              {currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s turn
            </p>
          )}
          {msg && (
            <p
              className={`text-base font-bold ${
                gameStatus === 'checkmate'
                  ? 'text-yellow-400'
                  : gameStatus === 'stalemate'
                  ? 'text-blue-400'
                  : 'text-red-400'
              }`}
            >
              {msg}
            </p>
          )}
          <p className="text-xs text-gray-600">Move {moveCount}</p>
        </div>

        <ChessBoard
          board={board}
          selectedPosition={selectedPosition}
          validMoves={validMoves}
          onSquareClick={handleSquareClick}
        />

        <div className="mt-5 text-center">
          <button
            onClick={resetGame}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-150 shadow"
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
