import type { RankedTrainer } from './types';

type AIFlag =
  | 'AI_BASIC' | 'AI_SETUP' | 'AI_TYPES' | 'AI_OFFENSIVE'
  | 'AI_SMART' | 'AI_OPPORTUNIST' | 'AI_AGGRESSIVE'
  | 'AI_CAUTIOUS' | 'AI_STATUS' | 'AI_RISKY';
type SwitchFlag = 'SWITCH_OFTEN' | 'SWITCH_SOMETIMES' | 'SWITCH_RARELY' | null;
type TrainerItem = string | null;
type ItemUseFlag = 'CONTEXT_USE' | 'ALWAYS_USE' | null;

export interface LogEvent {
  type: string;
  side?: 'p1' | 'p2';
  text: string;
}

export interface TurnLog {
  turn: number;
  events: LogEvent[];
}

export interface BattleLog {
  setup: LogEvent[];
  turns: TurnLog[];
  result: LogEvent;
  p1: { name: string; id: string };
  p2: { name: string; id: string };
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash;
}

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getSide(pokemonStr: string): 'p1' | 'p2' | undefined {
  if (pokemonStr?.startsWith('p1')) return 'p1';
  if (pokemonStr?.startsWith('p2')) return 'p2';
  return undefined;
}

function pokeName(str: string): string {
  if (!str) return '';
  return str.includes(': ') ? str.split(': ').slice(1).join(': ') : str;
}

const STATUS_NAMES: Record<string, string> = {
  brn: 'burned', par: 'paralyzed', slp: 'fell asleep',
  frz: 'was frozen', psn: 'was poisoned', tox: 'was badly poisoned',
};

function parseProtocolLine(line: string): LogEvent | null {
  if (!line || line.startsWith('|request|') || line.startsWith('|t:|') || line === '|') return null;

  const parts = line.split('|');
  if (parts.length < 2) return null;
  const type = parts[1];

  switch (type) {
    case 'switch':
    case 'drag': {
      const side = getSide(parts[2]);
      const mon = pokeName(parts[2]);
      const hp = parts[4] ?? '';
      const verb = type === 'drag' ? 'was dragged out' : 'went out';
      return { type: 'switch', side, text: `${mon} ${verb}! (${hp})` };
    }
    case 'move': {
      const side = getSide(parts[2]);
      const mon = pokeName(parts[2]);
      const move = parts[3] ?? '';
      return { type: 'move', side, text: `${mon} used ${move}!` };
    }
    case '-damage': {
      const side = getSide(parts[2]);
      const mon = pokeName(parts[2]);
      const hp = parts[3] ?? '';
      const from = parts[4] ?? '';
      const extra = from ? ` [${from.replace('[from] ', '')}]` : '';
      return { type: 'damage', side, text: `${mon}: ${hp}${extra}` };
    }
    case '-heal': {
      const side = getSide(parts[2]);
      const mon = pokeName(parts[2]);
      const hp = parts[3] ?? '';
      return { type: 'heal', side, text: `${mon} recovered HP (${hp})` };
    }
    case 'faint': {
      const side = getSide(parts[2]);
      const mon = pokeName(parts[2]);
      return { type: 'faint', side, text: `${mon} fainted!` };
    }
    case '-status': {
      const side = getSide(parts[2]);
      const mon = pokeName(parts[2]);
      const status = parts[3] ?? '';
      return { type: 'status', side, text: `${mon} ${STATUS_NAMES[status] ?? `got ${status}`}!` };
    }
    case '-curestatus': {
      const side = getSide(parts[2]);
      const mon = pokeName(parts[2]);
      return { type: 'heal', side, text: `${mon} was cured!` };
    }
    case '-boost': {
      const side = getSide(parts[2]);
      const mon = pokeName(parts[2]);
      const stat = parts[3] ?? '';
      const amount = parts[4] ?? '1';
      return { type: 'boost', side, text: `${mon}'s ${stat} rose${Number(amount) > 1 ? ' sharply' : ''}!` };
    }
    case '-unboost': {
      const side = getSide(parts[2]);
      const mon = pokeName(parts[2]);
      const stat = parts[3] ?? '';
      const amount = parts[4] ?? '1';
      return { type: 'unboost', side, text: `${mon}'s ${stat} fell${Number(amount) > 1 ? ' sharply' : ''}!` };
    }
    case '-crit':
      return { type: 'info', side: getSide(parts[2]), text: 'A critical hit!' };
    case '-supereffective':
      return { type: 'info', side: getSide(parts[2]), text: "It's super effective!" };
    case '-resisted':
      return { type: 'info', side: getSide(parts[2]), text: "It's not very effective..." };
    case '-immune': {
      const mon = pokeName(parts[2]);
      return { type: 'info', side: getSide(parts[2]), text: `It doesn't affect ${mon}...` };
    }
    case '-miss': {
      const mon = pokeName(parts[2]);
      return { type: 'info', side: getSide(parts[2]), text: `${mon}'s attack missed!` };
    }
    case '-fail':
      return { type: 'info', side: getSide(parts[2]), text: 'But it failed!' };
    case 'cant': {
      const mon = pokeName(parts[2]);
      const reason = parts[3] ?? '';
      return { type: 'info', side: getSide(parts[2]), text: `${mon} can't move! (${reason})` };
    }
    case '-start': {
      const side = getSide(parts[2]);
      const mon = pokeName(parts[2]);
      const effect = parts[3] ?? '';
      return { type: 'status', side, text: `${mon}: ${effect}` };
    }
    case '-end': {
      const side = getSide(parts[2]);
      const mon = pokeName(parts[2]);
      const effect = parts[3] ?? '';
      return { type: 'info', side, text: `${mon}: ${effect} ended` };
    }
    case '-weather': {
      const weather = parts[2] ?? '';
      if (weather === 'none') return { type: 'info', text: 'The weather cleared.' };
      return { type: 'info', text: `Weather: ${weather}` };
    }
    case 'win': {
      const winner = parts[2] ?? '';
      return { type: 'result', text: `${winner} wins!` };
    }
    case 'tie':
      return { type: 'result', text: 'The battle ended in a tie!' };
    case '-activate': {
      const mon = pokeName(parts[2]);
      const effect = parts[3] ?? '';
      return { type: 'info', side: getSide(parts[2]), text: `${mon}: ${effect}` };
    }
    case '-sidestart':
    case '-sideend': {
      const side = getSide(parts[2]);
      const effect = parts[3] ?? '';
      return { type: 'info', side, text: `${effect} ${type === '-sidestart' ? 'started' : 'ended'}` };
    }
    default:
      return null;
  }
}

/**
 * Lazily loads @pkmn/sim and the AI modules only when a replay is requested.
 * This keeps the main bundle small — the sim is ~1MB+ and only needed for replays.
 */
export async function simulateBattle(
  t1: RankedTrainer,
  t2: RankedTrainer,
): Promise<BattleLog> {
  const [{ BattleStreams, Teams }, { ScoredPlayerAI }] = await Promise.all([
    import('@pkmn/sim'),
    import('../scripts/ai-gen2/player.js'),
  ]);

  const buildTeam = (pokemon: RankedTrainer['pokemon']): string | null => {
    const team = pokemon.map(p => ({
      name: '',
      species: p.species,
      item: p.item ?? '',
      ability: '',
      nature: '',
      evs: { hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 },
      ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
      moves: p.moves.length > 0
        ? p.moves.map(m => m.toLowerCase().replace(/\s+/g, ''))
        : ['tackle'],
      level: p.level,
      gender: '',
    }));
    return Teams.pack(team);
  };

  const team1 = buildTeam(t1.pokemon);
  const team2 = buildTeam(t2.pokemon);

  const h1 = hashCode(t1.id);
  const h2 = hashCode(t2.id);
  const seed: [number, number, number, number] = [
    h1 & 0xffff,
    h2 & 0xffff,
    (h1 >> 16) & 0xffff,
    (h2 >> 16) & 0xffff,
  ];

  const origRandom = Math.random;
  Math.random = mulberry32(h1 ^ h2);

  try {
    const battleStream = new BattleStreams.BattleStream();
    const streams = BattleStreams.getPlayerStreams(battleStream);

    const p1ai = new ScoredPlayerAI(
      streams.p1, battleStream, 'p1',
      (t1.aiFlags ?? []) as AIFlag[],
      (t1.switchFlag as SwitchFlag) ?? null,
      (t1.trainerItems as [TrainerItem, TrainerItem]) ?? [null, null],
      (t1.itemUseFlag as ItemUseFlag) ?? null,
    );
    const p2ai = new ScoredPlayerAI(
      streams.p2, battleStream, 'p2',
      (t2.aiFlags ?? []) as AIFlag[],
      (t2.switchFlag as SwitchFlag) ?? null,
      (t2.trainerItems as [TrainerItem, TrainerItem]) ?? [null, null],
      (t2.itemUseFlag as ItemUseFlag) ?? null,
    );

    void p1ai.start();
    void p2ai.start();

    void streams.omniscient.write(
      `>start ${JSON.stringify({ formatid: 'gen2customgame', seed })}\n` +
      `>player p1 ${JSON.stringify({ name: t1.name, team: team1 })}\n` +
      `>player p2 ${JSON.stringify({ name: t2.name, team: team2 })}`,
    );

    const allLines: string[] = [];
    let done = false;
    let turnNum = 0;

    for await (const chunk of streams.omniscient) {
      for (const line of chunk.split('\n')) {
        allLines.push(line);
        if (line.startsWith('|turn|')) {
          turnNum = parseInt(line.split('|')[2], 10);
        }
        if (line.startsWith('|win|') || line === '|tie' || line.startsWith('|tie|')) {
          done = true;
        }
      }
      if (done) break;
      if (turnNum > 500) {
        battleStream.destroy();
        break;
      }
    }

    const setup: LogEvent[] = [];
    const turns: TurnLog[] = [];
    let currentTurn: TurnLog | null = null;
    let resultEvent: LogEvent = { type: 'result', text: 'Battle timed out' };

    for (const line of allLines) {
      if (line.startsWith('|turn|')) {
        const num = parseInt(line.split('|')[2], 10);
        currentTurn = { turn: num, events: [] };
        turns.push(currentTurn);
        continue;
      }
      if (line.startsWith('|win|') || line === '|tie' || line.startsWith('|tie|')) {
        const evt = parseProtocolLine(line);
        if (evt) resultEvent = evt;
        continue;
      }
      const evt = parseProtocolLine(line);
      if (evt) {
        if (currentTurn) currentTurn.events.push(evt);
        else setup.push(evt);
      }
    }

    return {
      setup,
      turns,
      result: resultEvent,
      p1: { name: t1.name, id: t1.id },
      p2: { name: t2.name, id: t2.id },
    };
  } finally {
    Math.random = origRandom;
  }
}
