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
import {
  lookupOpening,
  getBookMoves,
  BookMove,
  OpeningName,
  MAX_BOOK_PLIES,
} from '../utils/openingBook';
import ChessBoard, { MovePreview } from './ChessBoard';

type Phase = 'setup' | 'explore' | 'off-book' | 'free';

// ── Opening card colours (red / green / blue) ─────────────────────────────────
const CARD_COLORS = ['#ef4444', '#22c55e', '#3b82f6'] as const;
type CardColorIdx = 0 | 1 | 2;

const CARD_BORDER = ['border-red-700', 'border-green-700', 'border-blue-700'] as const;
const CARD_BG    = ['bg-red-900/20', 'bg-green-900/20', 'bg-blue-900/20'] as const;
const CARD_LABEL = ['text-red-400', 'text-green-400', 'text-blue-400'] as const;
const CARD_DOT   = ['bg-red-500', 'bg-green-500', 'bg-blue-500'] as const;

interface OpeningCard {
  uci: string;
  san: string;
  lines: number;
  openingName: string | null;
  eco: string | null;
}

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
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [sanHistory, setSanHistory] = useState<string[]>([]);

  const [phase, setPhase] = useState<Phase>('setup');
  const [opening, setOpening] = useState<OpeningName | null>(null);
  const [positionTotal, setPositionTotal] = useState(0);
  const [correction, setCorrection] = useState<string | null>(null);

  // ── Opening card explorer state ───────────────────────────────────────────
  const [openingCards, setOpeningCards] = useState<OpeningCard[]>([]);
  const [selectedCardUci, setSelectedCardUci] = useState<string | null>(null);
  const [movePreviews, setMovePreviews] = useState<MovePreview[]>([]);

  // Pending off-book move so "Continue anyway" can apply it
  const pendingMove = useRef<{ from: Position; to: Position; uci: string } | null>(null);

  // Apply multiple state updates together
  const flush = (
    b: Board,
    cp: 'white' | 'black',
    ep: Position | null,
    cr: CastlingRights,
    mv: string[],
    sans: string[],
  ) => {
    setBoard(b);
    setCurrentPlayer(cp);
    setEnPassant(ep);
    setCastling(cr);
    setMoveHistory(mv);
    setSanHistory(sans);
  };

  const reset = () => {
    flush(createInitialBoard(), 'white', null, DEFAULT_CASTLING_RIGHTS, [], []);
    setSelected(null);
    setHighlights([]);
    setPhase('setup');
    setOpening(null);
    setPositionTotal(0);
    setCorrection(null);
    setOpeningCards([]);
    setSelectedCardUci(null);
    setMovePreviews([]);
    pendingMove.current = null;
  };

  // ── Opening cards builder ─────────────────────────────────────────────────
  // Builds top-3 suggestion cards for the side to move at the given position.
  const buildOpeningCards = (moves: BookMove[], historyAtPoint: string[]) => {
    const top3 = moves.slice(0, 3);
    const cards: OpeningCard[] = top3.map(m => {
      const named = lookupOpening([...historyAtPoint, m.uci]);
      return {
        uci: m.uci,
        san: m.san,
        lines: m.lines,
        openingName: named?.name ?? null,
        eco: named?.eco ?? null,
      };
    });
    setOpeningCards(cards);
    setSelectedCardUci(null);
    setPositionTotal(moves.reduce((s, m) => s + m.lines, 0));

    // Show destination squares for all 3 cards as coloured dots on the board
    setMovePreviews(top3.map((m, i) => ({
      to: uciToMove(m.uci).to,
      color: CARD_COLORS[i as CardColorIdx],
      san: m.san,
    })));
  };

  // Reverts movePreviews back to the initial "3 destination dots" state
  const revertPreviews = (cards: OpeningCard[]) => {
    setMovePreviews(
      cards.slice(0, 3).map((c, i) => ({
        to: uciToMove(c.uci).to,
        color: CARD_COLORS[i as CardColorIdx],
        san: c.san,
      }))
    );
  };

  // ── Start exploring (orientation only — the user plays both sides) ────────
  const startExploring = (color: 'white' | 'black') => {
    setOrientation(color);
    buildOpeningCards(getBookMoves([]), []);
    setPhase('explore');
  };

  // ── Off-book actions ──────────────────────────────────────────────────────

  const retry = useCallback(() => {
    pendingMove.current = null;
    setCorrection(null);
    setSelected(null);
    setHighlights([]);
    setPhase('explore');
  }, []);

  const continueAnyway = useCallback(() => {
    const p = pendingMove.current;
    if (!p) return;
    const r = doMove(board, p.from, p.to, castling, enPassant, currentPlayer);
    flush(r.board, r.player, r.enPassant, r.castling,
      [...moveHistory, p.uci], [...sanHistory, p.uci]);
    pendingMove.current = null;
    setCorrection(null);
    setOpeningCards([]);
    setSelectedCardUci(null);
    setMovePreviews([]);
    setPhase('free');
  }, [board, castling, enPassant, currentPlayer, moveHistory, sanHistory]);

  // ── Card selection ────────────────────────────────────────────────────────

  const handleCardSelect = useCallback((card: OpeningCard, cardIdx: number) => {
    // Toggle off if already selected
    if (selectedCardUci === card.uci) {
      setSelectedCardUci(null);
      setSelected(null);
      setHighlights([]);
      revertPreviews(openingCards);
      return;
    }

    setSelectedCardUci(card.uci);

    // Auto-select the piece on the FROM square so the user sees its valid moves
    const { from, to } = uciToMove(card.uci);
    setSelected(from);
    setHighlights(getValidMoves(board, from, currentPlayer, enPassant, castling));

    // Show top-3 replies after this card's move, colour-coded on the board
    const responses = getBookMoves([...moveHistory, card.uci]).slice(0, 3);
    if (responses.length > 0) {
      setMovePreviews(responses.map((resp, i) => ({
        to: uciToMove(resp.uci).to,
        color: CARD_COLORS[i as CardColorIdx],
        san: resp.san,
      })));
    } else {
      // End of book line — just show this card's own destination
      setMovePreviews([{
        to,
        color: CARD_COLORS[cardIdx as CardColorIdx],
        san: card.san,
      }]);
    }
  }, [selectedCardUci, openingCards, board, currentPlayer, enPassant, castling, moveHistory]);

  // ── Square click ──────────────────────────────────────────────────────────

  const handleSquareClick = useCallback((pos: Position) => {
    if (phase === 'setup') return;
    // Off-book state: board is locked, use the buttons
    if (phase === 'off-book') return;

    // Selection handling (identical for explore + free — user plays both sides)
    if (!selected) {
      const piece = board[pos.row][pos.col];
      if (piece && piece.color === currentPlayer) {
        setSelected(pos);
        setHighlights(getValidMoves(board, pos, currentPlayer, enPassant, castling));
        if (phase === 'explore') {
          setSelectedCardUci(null);
          revertPreviews(openingCards);
        }
      }
      return;
    }

    if (selected.row === pos.row && selected.col === pos.col) {
      setSelected(null); setHighlights([]);
      if (phase === 'explore') {
        setSelectedCardUci(null);
        revertPreviews(openingCards);
      }
      return;
    }

    const clickedPiece = board[pos.row][pos.col];
    if (clickedPiece && clickedPiece.color === currentPlayer) {
      setSelected(pos);
      setHighlights(getValidMoves(board, pos, currentPlayer, enPassant, castling));
      if (phase === 'explore') {
        setSelectedCardUci(null);
        revertPreviews(openingCards);
      }
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
    const r = doMove(board, from, pos, castling, enPassant, currentPlayer);

    // Free-play mode: just apply the move
    if (phase === 'free') {
      flush(r.board, r.player, r.enPassant, r.castling,
        [...moveHistory, uci], [...sanHistory, uci]);
      return;
    }

    // Explore mode: check the move against the book
    const options = getBookMoves(moveHistory);
    const match = options.find(m => m.uci === uci);

    if (options.length > 0 && !match) {
      // Off-book: freeze board, offer retry / continue
      pendingMove.current = { from, to: pos, uci };
      setCorrection(options[0].san);
      setSelectedCardUci(null);
      setMovePreviews([]);
      setPhase('off-book');
      return;
    }

    const h = [...moveHistory, uci];
    const sans = [...sanHistory, match?.san ?? uci];
    flush(r.board, r.player, r.enPassant, r.castling, h, sans);
    setOpening(lookupOpening(h) ?? opening);
    setSelectedCardUci(null);

    // Book exhausted or 10 moves reached → free play
    const next = h.length >= MAX_BOOK_PLIES ? [] : getBookMoves(h);
    if (next.length === 0) {
      setOpeningCards([]);
      setMovePreviews([]);
      setPhase('free');
      return;
    }

    buildOpeningCards(next, h);
  }, [board, selected, currentPlayer, phase, enPassant, castling,
      moveHistory, sanHistory, openingCards, opening]);

  // ── Setup screen ──────────────────────────────────────────────────────────

  if (phase === 'setup') {
    return (
      <div className="flex flex-col items-center gap-8 py-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-1">Opening Explorer</h2>
          <p className="text-gray-400 text-sm max-w-sm">
            Explore book lines for the first 10 moves. You play both sides —
            pick suggested continuations or find your own.
          </p>
        </div>

        <div className="flex gap-4">
          {(['white', 'black'] as const).map(c => (
            <button
              key={c}
              onClick={() => startExploring(c)}
              className={`w-36 py-5 rounded-xl font-bold text-lg shadow-lg transition-colors flex flex-col items-center gap-1 ${
                c === 'white'
                  ? 'bg-[#F0D9B5] hover:bg-[#e8d0a8] text-gray-900'
                  : 'bg-gray-700 hover:bg-gray-600 text-white border border-gray-600'
              }`}
            >
              <span className="text-3xl">{c === 'white' ? '♔' : '♚'}</span>
              <span className="text-sm">View as {c === 'white' ? 'White' : 'Black'}</span>
            </button>
          ))}
        </div>

        <button onClick={onExit} className="text-gray-500 hover:text-gray-400 text-sm">
          ← Back to Free Play
        </button>
      </div>
    );
  }

  // ── Move history (SAN pairs) ───────────────────────────────────────────────

  const movePairs = sanHistory.reduce<string[][]>((acc, m, i) => {
    if (i % 2 === 0) acc.push([m]);
    else acc[acc.length - 1].push(m);
    return acc;
  }, []);

  const moveNumber = Math.floor(moveHistory.length / 2) + 1;

  // ── Main explorer layout ──────────────────────────────────────────────────

  return (
    <div className="flex gap-5 items-start">
      <ChessBoard
        board={board}
        selectedPosition={selected}
        validMoves={highlights}
        onSquareClick={handleSquareClick}
        flipped={orientation === 'black'}
        movePreviews={movePreviews}
      />

      {/* Side panel */}
      <div className="w-56 flex flex-col gap-3 shrink-0">

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
        {phase === 'explore' && (
          <div className="bg-green-900/40 border border-green-800 rounded-lg p-3">
            <p className="text-green-400 text-sm font-semibold">✓ On book</p>
            <p className="text-gray-400 text-xs mt-0.5">
              {currentPlayer === 'white' ? '⬜ White' : '⬛ Black'} to move · move {moveNumber} of 10
            </p>
          </div>
        )}

        {phase === 'off-book' && (
          <div className="bg-red-900/40 border border-red-800 rounded-lg p-3">
            <p className="text-red-400 text-sm font-semibold mb-1">✗ Off book</p>
            {correction && (
              <p className="text-gray-300 text-xs mb-3">
                Most popular:{' '}
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
            <p className="text-gray-400 text-xs mt-0.5">
              {moveHistory.length >= MAX_BOOK_PLIES
                ? '10 moves reached — continue freely'
                : 'End of book — continue freely'}
            </p>
          </div>
        )}

        {/* ── Opening card explorer ─────────────────────────────────────── */}
        {phase === 'explore' && openingCards.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Continuations · {currentPlayer === 'white' ? 'White' : 'Black'}
            </div>
            <div className="flex flex-col gap-1.5">
              {openingCards.map((card, i) => {
                const isSelected = selectedCardUci === card.uci;
                const pct = positionTotal > 0
                  ? Math.round((card.lines / positionTotal) * 100)
                  : 0;

                return (
                  <div
                    key={card.uci}
                    onClick={() => handleCardSelect(card, i)}
                    className={`rounded-lg border p-2 cursor-pointer transition-all ${
                      isSelected
                        ? `${CARD_BG[i as CardColorIdx]} ${CARD_BORDER[i as CardColorIdx]}`
                        : 'border-gray-700 hover:border-gray-500 hover:bg-gray-700/40'
                    }`}
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${CARD_DOT[i as CardColorIdx]}`} />
                      <span className="text-white font-mono text-sm font-bold">{card.san}</span>
                      <span className="text-gray-500 text-xs ml-auto">{pct}%</span>
                    </div>

                    {/* Opening name */}
                    <div className="mt-0.5 pl-3.5">
                      {card.openingName ? (
                        <span className={`text-xs ${CARD_LABEL[i as CardColorIdx]} leading-tight`}>
                          {card.eco ? <span className="font-mono mr-1 opacity-75">{card.eco}</span> : null}
                          {card.openingName}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">Book move</span>
                      )}
                    </div>

                    {/* Replies shown when this card is selected */}
                    {isSelected && (
                      <div className="mt-2 pt-2 border-t border-gray-700/60">
                        <div className="text-xs text-gray-500 mb-1.5">Top replies:</div>
                        {movePreviews.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {movePreviews.map((p, j) => (
                              <div key={j} className="flex items-center gap-1.5">
                                <div
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: p.color }}
                                />
                                <span
                                  className="font-mono text-xs font-semibold"
                                  style={{ color: p.color }}
                                >
                                  {p.san}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">End of book line</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Move history */}
        {sanHistory.length > 0 && (
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
