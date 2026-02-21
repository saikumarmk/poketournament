/**
 * Custom AI player for Gen 3 battles.
 *
 * Extends RandomPlayerAI, overriding:
 * - receiveRequest: item usage → voluntary switching → move selection
 * - chooseMove: use scoring system (higher score = better, unlike Gen 2)
 * - chooseSwitch: smart switch candidate selection
 */
import { BattleStreams, RandomPlayerAI } from '@pkmn/sim';
import type { AIFlag } from './scoring.js';
import { scoreMoves, pickMoveFromScores } from './scoring.js';
import { shouldSwitch, getMostSuitableMonToSwitchInto } from './switch.js';
import { tryUseItem, createItemState, type TrainerItem } from './items.js';

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
  private readonly itemState: ReturnType<typeof createItemState>;

  constructor(
    playerStream: ConstructorParameters<typeof RandomPlayerAI>[0],
    battleStream: BattleStream,
    sideId: 'p1' | 'p2',
    aiFlags: AIFlag[],
    trainerItems: TrainerItem[] = [],
  ) {
    super(playerStream, { move: 1.0 });
    this.battleStream = battleStream;
    this.sideId = sideId;
    this.aiFlags = aiFlags;
    this.itemState = createItemState(trainerItems);
  }

  override receiveRequest(request: ChoiceRequest): void {
    if (request.wait || request.forceSwitch || request.teamPreview || !request.active) {
      super.receiveRequest(request as any);
      return;
    }

    const battle = this.battleStream.battle;

    if (battle) {
      const aiSide = battle[this.sideId];
      if (aiSide) {
        const usedItem = tryUseItem(battle, aiSide, this.itemState);
        if (usedItem) {
          super.receiveRequest(request as any);
          return;
        }
      }
    }

    if (battle && request.side?.pokemon) {
      const aiSide = battle[this.sideId];
      const playerSide = battle[this.sideId === 'p1' ? 'p2' : 'p1'];

      if (aiSide && playerSide) {
        const active = request.active[0];
        const isTrapped = active?.trapped || active?.maybeTrapped;

        if (!isTrapped) {
          const result = shouldSwitch(battle, aiSide, playerSide);
          if (result.doSwitch) {
            let switchTo = result.switchTo;
            if (switchTo <= 0) {
              switchTo = getMostSuitableMonToSwitchInto(battle, aiSide, playerSide);
            }
            if (switchTo > 0) {
              const pokemon = request.side.pokemon;
              const target = pokemon[switchTo - 1];
              if (target && !target.active && !target.condition.endsWith(' fnt')) {
                this.choose(`switch ${switchTo}`);
                return;
              }
            }
          }
        }
      }
    }

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
    if (!aiSide || !playerSide) return moves[0].choice;

    const scores = scoreMoves(battle, aiSide, playerSide, this.aiFlags);

    let bestScore = -Infinity;
    let bestChoices: string[] = [];

    for (const m of moves) {
      const slotIdx = m.move.slot - 1;
      const score = scores[slotIdx] ?? 0;

      if (score > bestScore) {
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
    if (!aiSide || !playerSide) return switches[0].slot;
    const bestSlot = getMostSuitableMonToSwitchInto(battle, aiSide, playerSide);

    if (bestSlot > 0 && switches.some(s => s.slot === bestSlot)) {
      return bestSlot;
    }

    return switches[0].slot;
  }
}
