import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  fetchPosition,
  fetchCloudEval,
  LichessMove,
  LichessOpening,
  gameCount,
  OPENINGS,
  OpeningDef,
} from '../utils/lichessApi';
import { boardToFen } from '../utils/fenUtils';
import ChessBoard from './ChessBoard';

type Phase = 'browse' | 'select-color' | 'setup' | 'player' | 'thinking' | 'off-book' | 'free';

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

// ── Eval Bar ────────────────────────────────────────────────────────────────

interface EvalBarProps {
  cp: number | null;
  mate: number | null;
  depth: number;
}

const EvalBar: React.FC<EvalBarProps> = ({ cp, mate, depth }) => {
  let whitePercent = 50;
  let label = '0.00';

  if (mate !== null) {
    whitePercent = mate > 0 ? 95 : 5;
    label = `M${Math.abs(mate)}`;
  } else if (cp !== null) {
    // sigmoid-like clamping: ±800cp → ~90%/10%
    const clamped = Math.max(-800, Math.min(800, cp));
    whitePercent = 50 + (clamped / 800) * 45;
    const pawns = Math.abs(cp) / 100;
    label = (cp >= 0 ? '+' : '−') + pawns.toFixed(2);
  }

  const blackPercent = 100 - whitePercent;

  return (
    <div className="flex flex-col items-center gap-1" style={{ height: 576, width: 28 }}>
      <span className="text-gray-400 text-[10px] font-mono leading-tight">
        {cp !== null || mate !== null ? label : '...'}
      </span>
      <div
        className="flex flex-col rounded overflow-hidden border border-gray-600"
        style={{ width: 18, flex: 1 }}
      >
        <div
          className="bg-gray-200 transition-all duration-500"
          style={{ height: `${blackPercent}%` }}
        />
        <div
          className="bg-gray-800 transition-all duration-500"
          style={{ height: `${whitePercent}%` }}
        />
      </div>
      {depth > 0 && (
        <span className="text-gray-600 text-[9px] font-mono">d{depth}</span>
      )}
    </div>
  );
};

// ── Opening Card ─────────────────────────────────────────────────────────────

interface OpeningCardProps {
  opening: OpeningDef;
  onPlay: (opening: OpeningDef, color: 'white' | 'black') => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  '1. e4 Openings': 'bg-amber-900/50 text-amber-300 border-amber-700',
  '1. d4 Openings': 'bg-blue-900/50 text-blue-300 border-blue-700',
  'Flank Openings': 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
};

const OpeningCard: React.FC<OpeningCardProps> = ({ opening, onPlay }) => {
  const moveLabels = opening.moves.map(uci => {
    const f = uci.slice(0, 2);
    const t = uci.slice(2, 4);
    return f + '-' + t;
  });

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-500 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-mono font-bold text-yellow-400">{opening.eco}</span>
          <h3 className="text-white font-bold text-sm leading-snug mt-0.5">{opening.name}</h3>
        </div>
      </div>

      <p className="text-gray-400 text-xs leading-relaxed flex-1">{opening.description}</p>

      <div className="flex flex-wrap gap-1">
        {moveLabels.map((m, i) => (
          <span
            key={i}
            className="px-1.5 py-0.5 bg-gray-700 text-gray-300 text-xs font-mono rounded"
          >
            {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''}{m}
          </span>
        ))}
      </div>

      <div className="flex gap-2 mt-1">
        <button
          onClick={() => onPlay(opening, 'white')}
          className="flex-1 py-1.5 bg-[#F0D9B5] hover:bg-[#e8d0a8] text-gray-900 text-xs font-bold rounded transition-colors"
        >
          ♔ White
        </button>
        <button
          onClick={() => onPlay(opening, 'black')}
          className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded border border-gray-600 transition-colors"
        >
          ♚ Black
        </button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

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

  const [phase, setPhase] = useState<Phase>('browse');
  const [selectedOpening, setSelectedOpening] = useState<OpeningDef | null>(null);
  const [opening, setOpening] = useState<LichessOpening | null>(null);
  const [bookMoves, setBookMoves] = useState<LichessMove[]>([]);
  const [positionTotal, setPositionTotal] = useState(0);
  const [correction, setCorrection] = useState<string | null>(null);

  const [evalData, setEvalData] = useState<{ cp: number | null; mate: number | null; depth: number } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const pendingMove = useRef<{ from: Position; to: Position; uci: string } | null>(null);

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

  const fetchEval = useCallback(async (
    b: Board,
    cp: 'white' | 'black',
    cr: CastlingRights,
    ep: Position | null,
  ) => {
    const fen = boardToFen(b, cp, cr, ep);
    const result = await fetchCloudEval(fen);
    if (result) {
      setEvalData({ cp: result.cp, mate: result.mate, depth: result.depth });
    }
  }, []);

  // Fetch eval whenever board state changes during training
  useEffect(() => {
    if (phase === 'player' || phase === 'free' || phase === 'off-book') {
      fetchEval(board, currentPlayer, castling, enPassant);
    }
  }, [board, currentPlayer, phase, castling, enPassant, fetchEval]);

  const reset = useCallback(() => {
    flush(createInitialBoard(), 'white', null, DEFAULT_CASTLING_RIGHTS, []);
    setSelected(null);
    setHighlights([]);
    setPhase('browse');
    setSelectedOpening(null);
    setOpening(null);
    setBookMoves([]);
    setPositionTotal(0);
    setCorrection(null);
    setEvalData(null);
    pendingMove.current = null;
  }, []);

  // ── Start training at an opening position ──────────────────────────────────

  const startTraining = useCallback(async (def: OpeningDef, color: 'white' | 'black') => {
    setSelectedOpening(def);
    setPlayerColor(color);
    setPhase('thinking');
    setEvalData(null);

    let b = createInitialBoard();
    let cp: 'white' | 'black' = 'white';
    let cr = DEFAULT_CASTLING_RIGHTS;
    let ep: Position | null = null;
    let history: string[] = [];

    try {
      // Play through opening moves
      for (const uci of def.moves) {
        const { from, to } = uciToMove(uci);
        const r = doMove(b, from, to, cr, ep, cp);
        b = r.board;
        cp = r.player;
        cr = r.castling;
        ep = r.enPassant;
        history = [...history, uci];
      }

      flush(b, cp, ep, cr, history);

      // If it's not the player's turn, let the bot make the first move
      if (cp !== color) {
        const botData = await fetchPosition(history);
        if (botData.opening) setOpening(botData.opening);

        if (botData.moves.length > 0) {
          await new Promise(res => setTimeout(res, 300));
          const botMove = botData.moves[0];
          const { from: bf, to: bt } = uciToMove(botMove.uci);
          const br = doMove(b, bf, bt, cr, ep, cp);
          b = br.board; cp = br.player; cr = br.castling; ep = br.enPassant;
          history = [...history, botMove.uci];
          flush(b, cp, ep, cr, history);
        }
      }

      // Fetch player's options
      const playerData = await fetchPosition(history);
      if (playerData.opening) setOpening(playerData.opening);
      setBookMoves(playerData.moves.slice(0, 6));
      setPositionTotal(playerData.white + playerData.draws + playerData.black);

    } catch {
      // API unavailable — fall into free play
    }

    setPhase('player');
  }, []);

  const handleOpeningSelect = useCallback((def: OpeningDef, color: 'white' | 'black') => {
    startTraining(def, color);
  }, [startTraining]);

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
    if (phase === 'thinking' || phase === 'browse' || phase === 'select-color' || phase === 'setup') return;

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

    if (phase === 'off-book') return;

    // Training: only accept the human player's color
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
      const data = await fetchPosition(moveHistory);
      const bookMove = data.moves.find(m => m.uci === uci);

      if (data.moves.length > 0 && !bookMove) {
        pendingMove.current = { from, to: pos, uci };
        setCorrection(data.moves[0].san);
        setPhase('off-book');
        return;
      }

      const r = doMove(board, from, pos, castling, enPassant, currentPlayer);
      const h = [...moveHistory, uci];
      flush(r.board, r.player, r.enPassant, r.castling, h);
      if (data.opening) setOpening(data.opening);

      const botData = await fetchPosition(h);
      if (botData.opening) setOpening(botData.opening);

      if (botData.moves.length === 0) {
        setBookMoves([]);
        setPhase('free');
        return;
      }

      await new Promise(res => setTimeout(res, 400));

      const botMove = botData.moves[0];
      const { from: bf, to: bt } = uciToMove(botMove.uci);
      const br = doMove(r.board, bf, bt, r.castling, r.enPassant, r.player);
      const bh = [...h, botMove.uci];
      flush(br.board, br.player, br.enPassant, br.castling, bh);

      const nextData = await fetchPosition(bh);
      if (nextData.opening) setOpening(nextData.opening);
      setBookMoves(nextData.moves.slice(0, 6));
      setPositionTotal(nextData.white + nextData.draws + nextData.black);
      setPhase('player');

    } catch {
      const r = doMove(board, from, pos, castling, enPassant, currentPlayer);
      flush(r.board, r.player, r.enPassant, r.castling, [...moveHistory, uci]);
      setBookMoves([]);
      setPhase('free');
    }
  }, [board, selected, currentPlayer, playerColor, phase, enPassant, castling, moveHistory]);

  // ── Browse / Opening Selection Screen ─────────────────────────────────────

  if (phase === 'browse') {
    const categories = ['All', ...Array.from(new Set(OPENINGS.map(o => o.category)))];
    const filtered = categoryFilter === 'All'
      ? OPENINGS
      : OPENINGS.filter(o => o.category === categoryFilter);

    const grouped: Record<string, OpeningDef[]> = {};
    for (const o of filtered) {
      if (!grouped[o.category]) grouped[o.category] = [];
      grouped[o.category].push(o);
    }

    return (
      <div className="flex flex-col gap-5" style={{ width: 760 }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Opening Explorer</h2>
            <p className="text-gray-400 text-xs mt-0.5">
              Train openings with Lichess master-game analysis
            </p>
          </div>
          <button
            onClick={onExit}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            ← Free Play
          </button>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                categoryFilter === cat
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Opening cards */}
        <div className="max-h-[520px] overflow-y-auto pr-1 space-y-5">
          {Object.entries(grouped).map(([cat, openings]) => (
            <div key={cat}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                {cat}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {openings.map(o => (
                  <OpeningCard key={o.id} opening={o} onPlay={handleOpeningSelect} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Training Layout ───────────────────────────────────────────────────────

  const movePairs = moveHistory.reduce<string[][]>((acc, m, i) => {
    if (i % 2 === 0) acc.push([m]);
    else acc[acc.length - 1].push(m);
    return acc;
  }, []);

  const flipped = playerColor === 'black';

  // Win% bar for book moves
  const renderWinBar = (m: LichessMove) => {
    const total = gameCount(m);
    if (total === 0) return null;
    const wPct = Math.round((m.white / total) * 100);
    const dPct = Math.round((m.draws / total) * 100);
    const bPct = 100 - wPct - dPct;
    return (
      <div className="flex rounded-sm overflow-hidden h-1.5 mt-1">
        <div className="bg-gray-200" style={{ width: `${wPct}%` }} />
        <div className="bg-gray-500" style={{ width: `${dPct}%` }} />
        <div className="bg-gray-800 border-t border-b border-gray-600" style={{ width: `${bPct}%` }} />
      </div>
    );
  };

  return (
    <div className="flex gap-4 items-start">
      {/* Eval bar */}
      <div className="flex flex-col items-center pt-0" style={{ marginTop: 2 }}>
        <EvalBar
          cp={evalData?.cp ?? null}
          mate={evalData?.mate ?? null}
          depth={evalData?.depth ?? 0}
        />
      </div>

      {/* Board */}
      <ChessBoard
        board={board}
        selectedPosition={selected}
        validMoves={highlights}
        onSquareClick={handleSquareClick}
        flipped={flipped}
      />

      {/* Side panel */}
      <div className="w-52 flex flex-col gap-3 shrink-0">

        {/* Opening info */}
        <div className="bg-gray-800 rounded-lg p-3">
          {selectedOpening && (
            <div className="text-xs text-gray-500 font-mono mb-0.5">{selectedOpening.eco}</div>
          )}
          {opening ? (
            <div>
              <span className="text-yellow-400 font-bold text-xs">{opening.eco} · </span>
              <span className="text-white text-sm font-semibold leading-snug">{opening.name}</span>
            </div>
          ) : selectedOpening ? (
            <span className="text-white text-sm font-semibold">{selectedOpening.name}</span>
          ) : (
            <span className="text-gray-400 text-sm">Starting position</span>
          )}

          {/* Eval summary */}
          {evalData && (
            <div className="mt-2 pt-2 border-t border-gray-700 flex items-center gap-2">
              <span className="text-xs text-gray-500">Eval:</span>
              <span className={`text-xs font-mono font-bold ${
                (evalData.cp ?? 0) > 30 ? 'text-gray-200' :
                (evalData.cp ?? 0) < -30 ? 'text-gray-500' : 'text-gray-400'
              }`}>
                {evalData.mate !== null
                  ? `M${Math.abs(evalData.mate)}`
                  : evalData.cp !== null
                    ? ((evalData.cp >= 0 ? '+' : '') + (evalData.cp / 100).toFixed(2))
                    : '—'
                }
              </span>
              <span className="text-gray-600 text-[10px]">d{evalData.depth}</span>
            </div>
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
              {playerColor === 'white' ? '⬜' : '⬛'} Your turn
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
            <p className="text-gray-400 text-xs mt-0.5">Continue freely from here</p>
          </div>
        )}

        {/* Book continuations */}
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
                <div key={m.uci} className="mb-3 last:mb-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-white text-sm font-mono font-semibold">{m.san}</span>
                    <span className="text-gray-500 text-xs">{pct}%</span>
                  </div>
                  {renderWinBar(m)}
                </div>
              );
            })}
            <div className="flex gap-2 mt-2 pt-2 border-t border-gray-700 text-[10px] text-gray-600">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-200 inline-block" />W</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-500 inline-block" />D</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-gray-700 border border-gray-600 inline-block" />B</span>
            </div>
          </div>
        )}

        {/* Move history */}
        {moveHistory.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Moves</div>
            <div className="font-mono text-xs space-y-0.5 max-h-32 overflow-y-auto">
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
          ← Choose Opening
        </button>
        <button
          onClick={onExit}
          className="text-gray-500 hover:text-gray-400 text-xs text-center"
        >
          ← Free Play
        </button>
      </div>
    </div>
  );
};

export default OpeningTrainer;
