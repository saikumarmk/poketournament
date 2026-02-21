import { useEffect, useRef } from 'react';
import type { BattleLog, LogEvent } from '../battle-sim';
import { trainerSpriteUrl } from '../data';
import type { RankedTrainer, Generation } from '../types';

interface Props {
  log: BattleLog;
  t1: RankedTrainer;
  t2: RankedTrainer;
  gen: Generation;
  onClose: () => void;
}

function eventClasses(evt: LogEvent): string {
  switch (evt.type) {
    case 'move': return 'text-gb-text';
    case 'damage': return 'text-gb-loss';
    case 'heal': return 'text-gb-win';
    case 'faint': return 'text-gb-loss font-bold';
    case 'switch': return 'text-gb-accent';
    case 'status': return 'text-yellow-400';
    case 'boost': return 'text-gb-win';
    case 'unboost': return 'text-gb-loss';
    case 'info': return 'text-gb-muted';
    case 'result': return 'text-gb-accent font-bold';
    default: return 'text-gb-dim';
  }
}

function sideIndicator(side?: 'p1' | 'p2'): string {
  if (!side) return '  ';
  return side === 'p1' ? 'P1' : 'P2';
}

export default function BattleReplay({ log, t1, t2, gen, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gb-card border-2 border-gb-border max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gb-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <img
                src={trainerSpriteUrl(t1.name, gen, t1.trainerClass)}
                alt="" className="w-7 h-7 trainer-sprite"
              />
              <span className="text-xxs text-gb-text">{t1.name}</span>
            </div>
            <span className="text-xxs text-gb-muted">vs</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xxs text-gb-text">{t2.name}</span>
              <img
                src={trainerSpriteUrl(t2.name, gen, t2.trainerClass)}
                alt="" className="w-7 h-7 trainer-sprite"
              />
            </div>
          </div>
          <button onClick={onClose} className="gb-btn text-xxs px-2 py-1">X</button>
        </div>

        {/* Battle log */}
        <div ref={scrollRef} className="overflow-y-auto p-3 space-y-2 flex-1 font-pokemon">
          {/* Setup phase */}
          {log.setup.length > 0 && (
            <div className="space-y-0.5">
              {log.setup.map((evt, i) => (
                <EventLine key={`s-${i}`} evt={evt} />
              ))}
            </div>
          )}

          {/* Turns */}
          {log.turns.map(turn => (
            <div key={turn.turn}>
              <div
                className="text-gb-dim border-b border-gb-border/30 pb-0.5 mb-1 mt-2"
                style={{ fontSize: '0.45rem' }}
              >
                TURN {turn.turn}
              </div>
              <div className="space-y-0.5">
                {turn.events.map((evt, i) => (
                  <EventLine key={`t${turn.turn}-${i}`} evt={evt} />
                ))}
              </div>
            </div>
          ))}

          {/* Result */}
          <div className="text-center pt-3 border-t border-gb-border mt-3">
            <span className={`text-xxs ${eventClasses(log.result)}`}>{log.result.text}</span>
            <div className="text-gb-muted mt-1" style={{ fontSize: '0.4rem' }}>
              {log.turns.length} turns
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventLine({ evt }: { evt: LogEvent }) {
  const isSubEvent = evt.type !== 'move' && evt.type !== 'switch' && evt.type !== 'faint';
  return (
    <div
      className={`${eventClasses(evt)} flex gap-1.5 ${isSubEvent ? 'pl-4' : ''}`}
      style={{ fontSize: '0.45rem', lineHeight: '1.4' }}
    >
      <span className="text-gb-border shrink-0 w-4 text-right" style={{ fontSize: '0.35rem' }}>
        {sideIndicator(evt.side)}
      </span>
      <span>{evt.text}</span>
    </div>
  );
}
