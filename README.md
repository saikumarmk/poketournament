# Pokémon Trainer Tournament

Every in-game trainer from Pokémon Red and Pokémon Crystal battles every other trainer in a full round-robin tournament. Gen 1 uses [@pkmn/engine](https://github.com/pkmn/engine) (Zig-based); Gen 2 uses [@pkmn/sim](https://github.com/pkmn/ps) with a custom AI ported from the pokecrystal disassembly. Rankings are computed via logistic regression Elo.

## Quick Start

```bash
pnpm install
pnpm dev
```

## Data Pipeline

### Gen 1 (Pokémon Red)

```bash
pnpm run parse-trainers        # Parse pokered ASM → data/trainers.json
pnpm run run-tournament         # ~153k battles via @pkmn/engine → data/battles.json
pnpm run calculate-elo          # Elo + matchups → public/data/rankings.json, matchups.json
```

Or all at once: `pnpm run generate`

### Gen 2 (Pokémon Crystal)

```bash
pnpm run parse-trainers-gen2    # Parse pokecrystal ASM → data/trainers-gen2.json
pnpm run run-tournament-gen2    # ~293k battles via @pkmn/sim → data/battles-gen2.json
pnpm run calculate-elo-gen2     # Elo + matchups → public/data/rankings-gen2.json, matchups-gen2.json
```

Or all at once: `pnpm run generate-gen2`

The Gen 2 tournament can be run in parallel by mode:

```bash
# Terminal 1
pnpm tsx scripts/run-tournament-gen2.ts normal

# Terminal 2
pnpm tsx scripts/run-tournament-gen2.ts lv50
```

With no argument, both modes run sequentially.

### Modes

Each generation has two tournament modes:

- **Normal** — original in-game levels
- **Level 50** — all Pokémon set to level 50

Toggle between them in the frontend via the URL parameter `?mode=lv50`.

## AI Systems

### Gen 1

Trainer classes in Pokémon Red are assigned up to three AI modifiers that adjust move priorities:

| Modifier | Effect |
|----------|--------|
| Mod 1 | Penalizes status moves if the opponent already has a status condition |
| Mod 2 | Slightly prefers setup/buff moves on turn 2 (original off-by-one quirk) |
| Mod 3 | Favors super-effective moves, penalizes not-very-effective when a better option exists |

Battles use `@pkmn/engine`, a Zig-based Gen I engine that accurately reproduces original mechanics including Gen I quirks (Focus Energy bug, 1/256 miss chance, etc.).

### Gen 2

A full port of the Pokémon Crystal AI from the [pokecrystal disassembly](https://github.com/pret/pokecrystal). Each move starts at score **20** (lower = better). Up to 10 scoring layers modify scores based on battle state:

| Layer | Effect |
|-------|--------|
| AI_BASIC | Prevents redundant moves (no Dream Eater on awake targets, no double status) |
| AI_SETUP | Favors stat-up moves on turn 1, penalizes them later |
| AI_TYPES | Super-effective −1, not-very-effective +1, immune +10 |
| AI_OFFENSIVE | Non-damaging moves +2 |
| AI_SMART | ~40 move-specific handlers (sleep combos, Self-Destruct logic, weather, Encore, etc.) |
| AI_OPPORTUNIST | Penalizes stall/setup moves at low HP |
| AI_AGGRESSIVE | Penalizes moves that aren't the highest-damage option |
| AI_CAUTIOUS | Penalizes residual/setup moves after turn 1 |
| AI_STATUS | Blocks status moves against immune types |
| AI_RISKY | Encourages finishing blows (−5 for KO moves) |

The AI also handles voluntary switching (type matchup evaluation with class-based probability) and item usage (potions, Full Restores, X-items for gym leaders and Elite Four).

## Frontend Features

- **Rankings table** — sortable, searchable by trainer name, class, location, or Pokémon species
- **Trainer detail** — full team display, stats, head-to-head matchup table with search
- **Battle replay** (Gen 2) — client-side re-simulation of any matchup turn by turn using @pkmn/sim with the full ported AI

## Directory Structure

```
data/                   # Pipeline intermediates (trainers, moves, battles)
public/data/            # Frontend-served files (rankings, matchups)
scripts/
  parse-trainers.ts     # Gen 1 trainer parser
  parse-trainers-gen2.ts# Gen 2 trainer parser
  run-tournament.ts     # Gen 1 tournament runner
  run-tournament-gen2.ts# Gen 2 tournament runner (with checkpointing)
  calculate-elo.ts      # Elo computation + matchup generation
  ai-gen2/              # Ported Gen 2 AI system
    scoring.ts          # 10 AI scoring layers (AI_BASIC through AI_RISKY)
    switch.ts           # Voluntary + forced switch logic
    items.ts            # Trainer item usage (potions, X-items, Full Heal)
    player.ts           # ScoredPlayerAI — integrates scoring, switching, items
    tables.ts           # Move/effect lookup tables
  ai/                   # Gen 1 AI system
    choice.ts           # Move selection with modifier pipeline
    modifiers.ts        # 3 modifier functions (status check, setup timing, type matchups)
  patch-sim.cjs         # Postinstall: strips unused data from @pkmn/sim (~10MB → ~3MB)
src/                    # React frontend
  pages/
    Home.tsx            # Explanation page with AI documentation
    Rankings.tsx        # Full trainer rankings table
    TrainerDetail.tsx   # Individual trainer stats + head-to-head + battle replay
  components/
    BattleReplay.tsx    # Turn-by-turn battle log display
  battle-sim.ts         # Client-side battle re-simulation (Gen 2)
  data.ts               # Data fetching utilities
  types.ts              # Shared TypeScript interfaces
```

## Tech Stack

- **Gen 1 Engine**: `@pkmn/engine` (Zig-based, fast)
- **Gen 2 Engine**: `@pkmn/sim` with custom AI (10 scoring layers, switching, items)
- **Frontend**: React + Vite + Tailwind CSS
- **Scripts**: TypeScript via `tsx`
- **Sprites**: Pokémon Showdown CDN + local trainer sprites from pokered/pokecrystal

## Prerequisites

- Node.js 22+
- pnpm
- Zig (master branch) — needed to build `@pkmn/engine`
- `pokered` disassembly at `./pokered/`
- `pokecrystal` disassembly at `./pokecrystal/`
