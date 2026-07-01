import React, { useState, useCallback } from 'react';
import { Board, Position, CastlingRights } from './types/chess';
import {
  createInitialBoard,
  isValidMove,
  getValidMoves,
  isInCheck,
  hasAnyValidMoves,
  promotePawn,
  getEnPassantTarget,
  updateCastlingRights,
  DEFAULT_CASTLING_RIGHTS,
} from './utils/chessLogic';
import ChessBoard from './components/ChessBoard';
import OpeningTrainer from './components/OpeningTrainer';

type AppMode = 'play' | 'train';
type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate';

interface Snapshot {
  board: Board;
  currentPlayer: 'white' | 'black';
  gameStatus: GameStatus;
  winner: string | null;
  enPassantTarget: Position | null;
  castlingRights: CastlingRights;
}

function App() {
  const [mode, setMode] = useState<AppMode>('play');

  // ── Free play state ───────────────────────────────────────────────────────
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black'>('white');
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [winner, setWinner] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<Position[]>([]);
  const [moveCount, setMoveCount] = useState(0);
  const [enPassantTarget, setEnPassantTarget] = useState<Position | null>(null);
  const [castlingRights, setCastlingRights] = useState<CastlingRights>(DEFAULT_CASTLING_RIGHTS);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [flipped, setFlipped] = useState(false);

  const resetGame = () => {
    setBoard(createInitialBoard());
    setSelectedPosition(null);
    setCurrentPlayer('white');
    setGameStatus('playing');
    setWinner(null);
    setValidMoves([]);
    setMoveCount(0);
    setEnPassantTarget(null);
    setCastlingRights(DEFAULT_CASTLING_RIGHTS);
    setHistory([]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const snap = history[history.length - 1];
    setBoard(snap.board);
    setCurrentPlayer(snap.currentPlayer);
    setGameStatus(snap.gameStatus);
    setWinner(snap.winner);
    setEnPassantTarget(snap.enPassantTarget);
    setCastlingRights(snap.castlingRights);
    setMoveCount(history.length - 1);
    setSelectedPosition(null);
    setValidMoves([]);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleSquareClick = useCallback(
    (position: Position) => {
      if (gameStatus === 'checkmate' || gameStatus === 'stalemate') return;

      if (!selectedPosition) {
        const piece = board[position.row][position.col];
        if (piece && piece.color === currentPlayer) {
          setSelectedPosition(position);
          setValidMoves(getValidMoves(board, position, currentPlayer, enPassantTarget, castlingRights));
        }
        return;
      }

      if (selectedPosition.row === position.row && selectedPosition.col === position.col) {
        setSelectedPosition(null);
        setValidMoves([]);
        return;
      }

      const clickedPiece = board[position.row][position.col];
      if (clickedPiece && clickedPiece.color === currentPlayer) {
        setSelectedPosition(position);
        setValidMoves(getValidMoves(board, position, currentPlayer, enPassantTarget, castlingRights));
        return;
      }

      if (isValidMove(board, selectedPosition, position, currentPlayer, enPassantTarget, castlingRights)) {
        const movingPiece = board[selectedPosition.row][selectedPosition.col]!;
        let newBoard = board.map(row => [...row]);

        newBoard[position.row][position.col] = movingPiece;
        newBoard[selectedPosition.row][selectedPosition.col] = null;

        if (movingPiece.type === 'king' && Math.abs(position.col - selectedPosition.col) === 2) {
          const rRow = selectedPosition.row;
          if (position.col === 6) { newBoard[rRow][5] = newBoard[rRow][7]; newBoard[rRow][7] = null; }
          else                    { newBoard[rRow][3] = newBoard[rRow][0]; newBoard[rRow][0] = null; }
        }

        if (movingPiece.type === 'pawn' &&
            enPassantTarget &&
            position.row === enPassantTarget.row &&
            position.col === enPassantTarget.col) {
          newBoard[selectedPosition.row][position.col] = null;
        }

        newBoard = promotePawn(newBoard, position);

        const newCastlingRights = updateCastlingRights(castlingRights, selectedPosition, position, movingPiece);
        const newEnPassantTarget = getEnPassantTarget(selectedPosition, position, movingPiece);
        const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';
        const inCheck = isInCheck(newBoard, nextPlayer);
        const hasMoves = hasAnyValidMoves(newBoard, nextPlayer, newEnPassantTarget, newCastlingRights);

        let newStatus: GameStatus;
        if (!hasMoves) {
          newStatus = inCheck ? 'checkmate' : 'stalemate';
          if (newStatus === 'checkmate')
            setWinner(currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1));
        } else {
          newStatus = inCheck ? 'check' : 'playing';
        }

        setHistory(prev => [...prev, { board, currentPlayer, gameStatus, winner, enPassantTarget, castlingRights }]);
        setBoard(newBoard);
        setCurrentPlayer(nextPlayer);
        setGameStatus(newStatus);
        setMoveCount(n => n + 1);
        setCastlingRights(newCastlingRights);
        setEnPassantTarget(newEnPassantTarget);
      }

      setSelectedPosition(null);
      setValidMoves([]);
    },
    [board, selectedPosition, currentPlayer, gameStatus, winner, enPassantTarget, castlingRights],
  );

  const statusMessage = () => {
    if (gameStatus === 'checkmate') return `Checkmate — ${winner} wins!`;
    if (gameStatus === 'stalemate') return 'Stalemate — Draw!';
    if (gameStatus === 'check')
      return `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)} is in check!`;
    return null;
  };

  const msg = statusMessage();

  // ── Mode tab styles ───────────────────────────────────────────────────────
  const tabClass = (m: AppMode) =>
    `px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
      mode === m
        ? 'bg-blue-600 text-white'
        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
    }`;

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center p-4">
      <div className="bg-gray-900 px-8 pt-8 pb-6 rounded-xl shadow-2xl">
        <h1 className="text-3xl font-bold mb-5 text-center text-white tracking-widest uppercase">
          Chess
        </h1>

        {/* Mode switcher */}
        <div className="flex gap-1 justify-center mb-6 bg-gray-800 rounded-xl p-1">
          <button className={tabClass('play')} onClick={() => setMode('play')}>
            Free Play
          </button>
          <button className={tabClass('train')} onClick={() => setMode('train')}>
            Opening Trainer
          </button>
        </div>

        {/* Free play */}
        {mode === 'play' && (
          <>
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
              flipped={flipped}
            />

            <div className="mt-5 flex gap-2 justify-center flex-wrap">
              <button
                onClick={undo}
                disabled={history.length === 0}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-150 shadow text-sm"
              >
                ↩ Undo
              </button>
              <button
                onClick={() => setFlipped(f => !f)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors duration-150 shadow text-sm"
              >
                ⇅ Flip Board
              </button>
              <button
                onClick={resetGame}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-150 shadow text-sm"
              >
                New Game
              </button>
            </div>
          </>
        )}

        {/* Opening trainer */}
        {mode === 'train' && (
          <OpeningTrainer onExit={() => setMode('play')} />
        )}
      </div>
    </div>
  );
}

export default App;
