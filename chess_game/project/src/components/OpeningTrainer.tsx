import React, { useState, useCallback, useRef } from 'react';
import { Board, Position, CastlingRights } from '../types/chess';
import {
  createInitialBoard,
  getValidMoves,
  promotePawn,
  getEnPassantTarget,
  updateCastlingRights,
  DEFAULT_CASTLING_RIGHTS,
} from '../utils/chessLogic';
import { moveToUci, uciToMove } from '../utils/uciUtils';
import { fetchPosition, LichessMove, LichessOpening, gameCount } from '../utils/lichessApi';
import ChessBoard from './ChessBoard';

type Phase = 'setup' | 'player' | 'thinking' | 'off-book' | 'free';

// Applies a move (+ castling / en passant / promotion side effects) and returns updated state.
const doMove = (
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

interface Props {
  onExit: () => void;
}

const OpeningTrainer: React.FC<Props> = ({ onExit }) => {
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [selected, setSelected] = useState<Position | null>(null);
  const [highlights, setHighlights] = useState<Position[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black'>('white');
  const [enPassant, setEnPassant] = useState<Position | null>(null);
  const [castling, setCastling] = useState<CastlingRights>(DEFAULT_CASTLING_RIGHTS);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  const [phase, setPhase] = useState<Phase>('setup');
  const [opening, setOpening] = useState<LichessOpening | null>(null);
  const [bookMoves, setBookMoves] = useState<LichessMove[]>([]);
  const [positionTotal, setPositionTotal] = useState(0);
  const [correction, setCorrection] = useState<string | null>(null);

  // Pending off-book move so "Continue anyway" can apply it
  const pendingMove = useRef<{ from: Position; to: Position; uci: string } | null>(null);

  // Apply multiple state updates together
  const flush = (
    b: Board,
    cp: 'white' | 'black',
    ep: Position | null,
    cr: CastlingRights,
    mv: string[],
  ) => {
    setBoard(b);
    setCurrentPlayer(cp);
    setEnPassant(ep);
    setCastling(cr);
    setMoveHistory(mv);
  };

  const reset = () => {
    flush(createInitialBoard(), 'white', null, DEFAULT_CASTLING_RIGHTS, []);
    setSelected(null);
    setHighlights([]);
    setPhase('setup');
    setOpening(null);
    setBookMoves([]);
    setPositionTotal(0);
    setCorrection(null);
    pendingMove.current = null;
  };

  // ── Color selection + initial book fetch ──────────────────────────────────

  const startTraining = async (color: 'white' | 'black') => {
    setPlayerColor(color);
    setPhase('thinking');

    try {
      const data = await fetchPosition([]);

      if (color === 'black' && data.moves.length > 0) {
        // Bot plays white's first move
        const botMove = data.moves[0];
        const { from, to } = uciToMove(botMove.uci);
        const r = doMove(createInitialBoard(), from, to, DEFAULT_CASTLING_RIGHTS, null, 'white');
        const h = [botMove.uci];
        flush(r.board, r.player, r.enPassant, r.castling, h);
        if (data.opening) setOpening(data.opening);

        // Fetch player's options for their first move
        const playerData = await fetchPosition(h);
        setBookMoves(playerData.moves.slice(0, 5));
        setPositionTotal(playerData.white + playerData.draws + playerData.black);
        if (playerData.opening) setOpening(playerData.opening);
        setPhase('player');
      } else if (color === 'black') {
        // No bot moves available — fall back to free play as black isn't possible
        setPhase('free');
      } else {
        setBookMoves(data.moves.slice(0, 5));
        setPositionTotal(data.white + data.draws + data.black);
        if (data.opening) setOpening(data.opening);
        setPhase('player');
      }
    } catch {
      // API unavailable — fall back to free play (board stays flipped for black)
      setPhase('free');
    }
  };

  // ── Off-book actions ──────────────────────────────────────────────────────

  const retry = useCallback(() => {
    pendingMove.current = null;
    setCorrection(null);
    setSelected(null);
    setHighlights([]);
    setPhase('player');
  }, []);

  const continueAnyway = useCallback(() => {
    const p = pendingMove.current;
    if (!p) return;
    const r = doMove(board, p.from, p.to, castling, enPassant, currentPlayer);
    flush(r.board, r.player, r.enPassant, r.castling, [...moveHistory, p.uci]);
    pendingMove.current = null;
    setCorrection(null);
    setBookMoves([]);
    setPhase('free');
  }, [board, castling, enPassant, currentPlayer, moveHistory]);

  // ── Square click ──────────────────────────────────────────────────────────

  const handleSquareClick = useCallback(async (pos: Position) => {
    if (phase === 'thinking' || phase === 'setup') return;

    // Free-play mode: normal chess, no book checking
    if (phase === 'free') {
      if (!selected) {
        const piece = board[pos.row][pos.col];
        if (piece && piece.color === currentPlayer) {
          setSelected(pos);
          setHighlights(getValidMoves(board, pos, currentPlayer, enPassant, castling));
        }
        return;
      }
      if (selected.row === pos.row && selected.col === pos.col) {
        setSelected(null); setHighlights([]); return;
      }
      const cp = board[pos.row][pos.col];
      if (cp && cp.color === currentPlayer) {
        setSelected(pos);
        setHighlights(getValidMoves(board, pos, currentPlayer, enPassant, castling));
        return;
      }
      const from = selected;
      const isLegal = getValidMoves(board, from, currentPlayer, enPassant, castling)
        .some(m => m.row === pos.row && m.col === pos.col);
      setSelected(null); setHighlights([]);
      if (!isLegal) return;
      const piece = board[from.row][from.col]!;
      const promo = piece.type === 'pawn' && (pos.row === 0 || pos.row === 7) ? 'q' : undefined;
      const r = doMove(board, from, pos, castling, enPassant, currentPlayer);
      flush(r.board, r.player, r.enPassant, r.castling, [...moveHistory, moveToUci(from, pos, promo)]);
      return;
    }

    // Off-book state: board is locked, use the buttons
    if (phase === 'off-book') return;

    // Training mode: only accept the human player's color
    if (currentPlayer !== playerColor) return;

    if (!selected) {
      const piece = board[pos.row][pos.col];
      if (piece && piece.color === currentPlayer) {
        setSelected(pos);
        setHighlights(getValidMoves(board, pos, currentPlayer, enPassant, castling));
      }
      return;
    }

    if (selected.row === pos.row && selected.col === pos.col) {
      setSelected(null); setHighlights([]); return;
    }

    const clickedPiece = board[pos.row][pos.col];
    if (clickedPiece && clickedPiece.color === currentPlayer) {
      setSelected(pos);
      setHighlights(getValidMoves(board, pos, currentPlayer, enPassant, castling));
      return;
    }

    const from = selected;
    const isLegal = getValidMoves(board, from, currentPlayer, enPassant, castling)
      .some(m => m.row === pos.row && m.col === pos.col);
    setSelected(null); setHighlights([]);
    if (!isLegal) return;

    const movingPiece = board[from.row][from.col]!;
    const promo = movingPiece.type === 'pawn' && (pos.row === 0 || pos.row === 7) ? 'q' : undefined;
    const uci = moveToUci(from, pos, promo);

    setPhase('thinking');

    try {
      // Verify the move against the book
      const data = await fetchPosition(moveHistory);
      const bookMove = data.moves.find(m => m.uci === uci);

      if (data.moves.length > 0 && !bookMove) {
        // Off-book: freeze board, show the main line move
        pendingMove.current = { from, to: pos, uci };
        setCorrection(data.moves[0].san);
        setPhase('off-book');
        return;
      }

      // Good move — apply it
      const r = doMove(board, from, pos, castling, enPassant, currentPlayer);
      const h = [...moveHistory, uci];
      flush(r.board, r.player, r.enPassant, r.castling, h);
      if (data.opening) setOpening(data.opening);

      // Fetch bot's response options
      const botData = await fetchPosition(h);
      if (botData.opening) setOpening(botData.opening);

      if (botData.moves.length === 0) {
        setBookMoves([]);
        setPhase('free');
        return;
      }

      // Short pause so the player can see their move land
      await new Promise(res => setTimeout(res, 420));

      // Bot plays the most popular book continuation
      const botMove = botData.moves[0];
      const { from: bf, to: bt } = uciToMove(botMove.uci);
      const br = doMove(r.board, bf, bt, r.castling, r.enPassant, r.player);
      const bh = [...h, botMove.uci];
      flush(br.board, br.player, br.enPassant, br.castling, bh);

      // Fetch player's options for the next turn
      const nextData = await fetchPosition(bh);
      if (nextData.opening) setOpening(nextData.opening);
      setBookMoves(nextData.moves.slice(0, 5));
      setPositionTotal(nextData.white + nextData.draws + nextData.black);
      setPhase('player');

    } catch {
      // API failure — apply the move and fall back to free play
      const r = doMove(board, from, pos, castling, enPassant, currentPlayer);
      flush(r.board, r.player, r.enPassant, r.castling, [...moveHistory, uci]);
      setBookMoves([]);
      setPhase('free');
    }
  }, [board, selected, currentPlayer, playerColor, phase, enPassant, castling, moveHistory]);

  // ── Setup screen ──────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="flex flex-col items-center gap-8 py-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-1">Opening Trainer</h2>
          <p className="text-gray-400 text-sm">
            Drill openings against the Lichess master game database
          </p>
        </div>

        <div className="flex gap-4">
          {(['white', 'black'] as const).map(c => (
            <button
              key={c}
              onClick={() => startTraining(c)}
              className={`w-36 py-5 rounded-xl font-bold text-lg shadow-lg transition-colors flex flex-col items-center gap-1 ${
                c === 'white'
                  ? 'bg-[#F0D9B5] hover:bg-[#e8d0a8] text-gray-900'
                  : 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
              }`}
            >
              <span className="text-3xl">{c === 'white' ? '♔' : '♚'}</span>
              <span className="text-sm">Play as {c === 'white' ? 'White' : 'Black'}</span>
            </button>
          ))}
        </div>

        <button onClick={onExit} className="text-gray-500 hover:text-gray-400 text-sm">
          ← Back to Free Play
        </button>
      </div>
    );
  }

  // ── Move history (UCI pairs) ───────────────────────────────────────────────

  const movePairs = moveHistory.reduce<string[][]>((acc, m, i) => {
    if (i % 2 === 0) acc.push([m]);
    else acc[acc.length - 1].push(m);
    return acc;
  }, []);

  // ── Main training layout ──────────────────────────────────────────────────

  return (
    <div className="flex gap-5 items-start">
      <ChessBoard
        board={board}
        selectedPosition={selected}
        validMoves={highlights}
        onSquareClick={handleSquareClick}
        flipped={playerColor === 'black'}
      />

      {/* Side panel */}
      <div className="w-52 flex flex-col gap-3 shrink-0">

        {/* Opening name */}
        <div className="bg-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Opening</div>
          {opening ? (
            <div>
              <span className="text-yellow-400 font-bold text-xs">{opening.eco} · </span>
              <span className="text-white text-sm font-semibold leading-snug">{opening.name}</span>
            </div>
          ) : (
            <span className="text-gray-400 text-sm">Starting position</span>
          )}
        </div>

        {/* Status card */}
        {phase === 'thinking' && (
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-gray-400 text-sm animate-pulse">Consulting book…</p>
          </div>
        )}

        {phase === 'player' && (
          <div className="bg-green-900/40 border border-green-800 rounded-lg p-3">
            <p className="text-green-400 text-sm font-semibold">✓ On book</p>
            <p className="text-gray-400 text-xs mt-0.5">
              {playerColor === 'white' ? '⬜' : '⬛'} Your move
            </p>
          </div>
        )}

        {phase === 'off-book' && (
          <div className="bg-red-900/40 border border-red-800 rounded-lg p-3">
            <p className="text-red-400 text-sm font-semibold mb-1">✗ Off book</p>
            {correction && (
              <p className="text-gray-300 text-xs mb-3">
                Book move:{' '}
                <span className="font-mono font-bold text-white">{correction}</span>
              </p>
            )}
            <button
              onClick={retry}
              className="w-full py-1.5 mb-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold rounded"
            >
              ↩ Retry
            </button>
            <button
              onClick={continueAnyway}
              className="w-full py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded"
            >
              Continue anyway
            </button>
          </div>
        )}

        {phase === 'free' && (
          <div className="bg-blue-900/40 border border-blue-800 rounded-lg p-3">
            <p className="text-blue-400 text-sm font-semibold">Opening complete</p>
            <p className="text-gray-400 text-xs mt-0.5">Continue from here freely</p>
          </div>
        )}

        {/* Book continuations — shown when it's the player's turn */}
        {phase === 'player' && bookMoves.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Book moves
            </div>
            {bookMoves.map(m => {
              const pct = positionTotal > 0
                ? Math.round((gameCount(m) / positionTotal) * 100)
                : 0;
              return (
                <div key={m.uci} className="mb-2.5 last:mb-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-white text-sm font-mono font-semibold">{m.san}</span>
                    <span className="text-gray-400 text-xs">{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1">
                    <div
                      className="bg-blue-500 h-1 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Move history */}
        {moveHistory.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Moves</div>
            <div className="font-mono text-xs space-y-0.5 max-h-36 overflow-y-auto">
              {movePairs.map((pair, i) => (
                <div key={i} className="flex gap-1">
                  <span className="text-gray-600 w-5 shrink-0">{i + 1}.</span>
                  <span className="text-gray-300">{pair[0]}</span>
                  {pair[1] && <span className="text-gray-400">{pair[1]}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={reset}
          className="py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          New Game
        </button>
        <button onClick={onExit} className="text-gray-500 hover:text-gray-400 text-xs text-center">
          ← Free Play
        </button>
      </div>
    </div>
  );
};

export default OpeningTrainer;
