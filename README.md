# Chess Game

A fully-featured chess game built with React, TypeScript, and Tailwind CSS. Includes a free play mode with complete rule enforcement and an opening trainer powered by the Lichess Opening Explorer.

## Features

- **Complete chess rules** — legal move validation, check/checkmate/stalemate detection
- **Castling** — kingside and queenside, with all conditions enforced (can't castle in, through, or into check)
- **En passant** — correctly tracked and cleared after each move
- **Move highlighting** — selected piece highlighted in yellow, valid moves shown as green dots, captures as red tint
- **Opening Trainer** — practice openings against a bot powered by the Lichess Masters database
  - Choose to play as White or Black
  - Bot plays the most popular book move in response
  - Shows book moves with win-rate bars and popularity percentages
  - Detects when you go off-book with option to continue freely or retry

## Requirements

- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

## Setup

```bash
# 1. Clone the repository
git clone https://github.com/daniel-lamb/chess-game.git
cd chess-game

# 2. Install dependencies
cd chess_game/project
npm install

# 3. Start the development server
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## How to Play

### Free Play

1. Click the **Free Play** tab (selected by default)
2. Click any white piece to select it — valid moves appear as green dots
3. Click a highlighted square to move; captures show with a red-tinted square
4. Click a different piece of the same color to switch selection
5. The status bar shows whose turn it is, check warnings, and checkmate/stalemate results
6. Click **New Game** to reset at any time

**Special moves:**
- **Castling** — move your king two squares toward a rook; the rook slides automatically. Both pieces must not have moved, squares between must be empty, and the king cannot be in, pass through, or land in check.
- **En passant** — after an opponent pawn advances two squares, you can capture it by moving your pawn diagonally to the square it passed through. Only available immediately after the double push.

### Opening Trainer

1. Click the **Opening Trainer** tab
2. Choose **Play as White** or **Play as Black**
3. Make your moves — the trainer checks them against the Lichess Masters database
4. If your move is in the book, the bot responds with the most popular reply and shows available continuations in the side panel
5. If you go off-book, choose **Retry** to pick a different move or **Continue freely** to keep playing without book guidance
6. The current opening name (ECO code) updates as you play

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Bundler | Vite |
| Opening data | [Lichess Opening Explorer API](https://lichess.org/api#tag/Opening-Explorer) |

## Project Structure

```
chess_game/project/src/
├── components/
│   ├── ChessBoard.tsx       # Board rendering, square highlights, piece display
│   └── OpeningTrainer.tsx   # Opening trainer UI and bot logic
├── utils/
│   ├── chessLogic.ts        # Move validation, check detection, castling, en passant
│   ├── lichessApi.ts        # Lichess Opening Explorer API client
│   └── uciUtils.ts          # UCI notation helpers (e2e4 format)
├── types/
│   └── chess.ts             # TypeScript types (Board, Piece, Position, CastlingRights)
└── App.tsx                  # Top-level state, mode switching, move execution
```

## Build for Production

```bash
cd chess_game/project
npm run build
```

Output goes to `chess_game/project/dist/`. Serve with any static file host (Netlify, Vercel, GitHub Pages, etc.).
