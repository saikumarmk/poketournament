/**
 * Custom AI player for Gen 2 battles.
 *
 * Extends RandomPlayerAI, overriding:
 * - receiveRequest: item usage → voluntary switching → move selection
 * - chooseMove: use ASM-ported scoring system
 * - chooseSwitch: smart switch candidate selection
 */
import { BattleStreams, RandomPlayerAI } from '@pkmn/sim';
import type { AIFlag } from './scoring.js';
import { scoreMoves } from './scoring.js';
import { evaluateVoluntarySwitch, pickBestSwitchMon, type SwitchFlag } from './switch.js';
import {
  tryUseItem, createItemState,
  type TrainerItem, type ItemUseFlag,
} from './items.js';

type BattleStream = InstanceType<typeof BattleStreams.BattleStream>;

interface MoveChoice {
  choice: string;
  move: { slot: number; move: string; target: string; zMove: boolean };
}

interface SwitchChoice {
  slot: number;
  pokemon: any;
}

interface ChoiceRequest {
  wait?: boolean;
  forceSwitch?: boolean[];
  active?: any[];
  side?: { pokemon: any[] };
  teamPreview?: boolean;
}

export class ScoredPlayerAI extends RandomPlayerAI {
  private readonly battleStream: BattleStream;
  private readonly sideId: 'p1' | 'p2';
  private readonly aiFlags: AIFlag[];
  private readonly switchFlag: SwitchFlag;
  private readonly itemState: ReturnType<typeof createItemState>;

  constructor(
    playerStream: ConstructorParameters<typeof RandomPlayerAI>[0],
    battleStream: BattleStream,
    sideId: 'p1' | 'p2',
    aiFlags: AIFlag[],
    switchFlag: SwitchFlag = null,
    trainerItems: [TrainerItem, TrainerItem] = [null, null],
    itemUseFlag: ItemUseFlag = null,
  ) {
    super(playerStream, { move: 1.0 });
    this.battleStream = battleStream;
    this.sideId = sideId;
    this.aiFlags = aiFlags;
    this.switchFlag = switchFlag;
    this.itemState = createItemState(trainerItems, itemUseFlag);
  }

  override receiveRequest(request: ChoiceRequest): void {
    if (request.wait || request.forceSwitch || request.teamPreview || !request.active) {
      super.receiveRequest(request as any);
      return;
    }

    const battle = this.battleStream.battle;

    // Priority 1: Try to use a trainer item (potions, X-items, etc.)
    // In the game, this consumes the trainer's turn.
    if (battle) {
      const aiSide = battle[this.sideId];
      const usedItem = tryUseItem(battle, aiSide, this.itemState);
      if (usedItem) {
        // Item used — still need to send a move command since the sim
        // requires one. We pick "move 1" as a no-op stand-in; the HP/status
        // modification has already been applied directly to the battle state.
        // NOTE: This means the AI effectively gets to both use an item AND
        // attack, which is slightly off from the game (where item usage
        // replaces the attack). This is an acceptable approximation since
        // @pkmn/sim has no "use item" action.
        super.receiveRequest(request as any);
        return;
      }
    }

    // Priority 2: Check for voluntary switch
    if (battle && this.switchFlag && request.side?.pokemon) {
      const aiSide = battle[this.sideId];
      const playerSide = battle[this.sideId === 'p1' ? 'p2' : 'p1'];

      const active = request.active[0];
      const isTrapped = active?.trapped || active?.maybeTrapped;

      if (!isTrapped) {
        const switchSlot = evaluateVoluntarySwitch(
          battle, aiSide, playerSide, this.switchFlag,
        );
        if (switchSlot > 0) {
          const pokemon = request.side.pokemon;
          const target = pokemon[switchSlot - 1];
          if (target && !target.active && !target.condition.endsWith(' fnt')) {
            this.choose(`switch ${switchSlot}`);
            return;
          }
        }
      }
    }

    // Priority 3: Fall through to move scoring
    super.receiveRequest(request as any);
  }

  override chooseMove(
    _active: unknown,
    moves: MoveChoice[],
  ): string {
    const battle = this.battleStream.battle;
    if (!battle || moves.length === 0) {
      return moves.length ? moves[0].choice : 'move 1';
    }

    const aiSide = battle[this.sideId];
    const playerSide = battle[this.sideId === 'p1' ? 'p2' : 'p1'];

    const scores = scoreMoves(battle, aiSide, playerSide, this.aiFlags);

    let bestScore = Infinity;
    let bestChoices: string[] = [];

    for (const m of moves) {
      const slotIdx = m.move.slot - 1;
      const score = scores[slotIdx] ?? 80;

      if (score < bestScore) {
        bestScore = score;
        bestChoices = [m.choice];
      } else if (score === bestScore) {
        bestChoices.push(m.choice);
      }
    }

    return bestChoices[Math.floor(Math.random() * bestChoices.length)];
  }

  override chooseSwitch(
    _active: unknown,
    switches: SwitchChoice[],
  ): number {
    const battle = this.battleStream.battle;
    if (!battle || switches.length === 0) {
      return switches.length ? switches[0].slot : 1;
    }

    const aiSide = battle[this.sideId];
    const playerSide = battle[this.sideId === 'p1' ? 'p2' : 'p1'];
    const bestSlot = pickBestSwitchMon(battle, aiSide, playerSide);

    if (bestSlot > 0 && switches.some(s => s.slot === bestSlot)) {
      return bestSlot;
    }

    return switches[0].slot;
  }
}
