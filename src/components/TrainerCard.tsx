import { spriteUrl } from '../data';
import type { RankedTrainer } from '../types';

interface Props {
  trainer: RankedTrainer;
  rank: number;
}

export default function TrainerCard({ trainer, rank }: Props) {
  const total = trainer.win + trainer.loss + trainer.draw;
  const winPct = total > 0 ? (trainer.win / total * 100).toFixed(1) : '0.0';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-full md:w-80 shrink-0">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl font-bold text-gray-600">#{rank}</div>
        <div>
          <h2 className="text-xl font-bold">{trainer.name}</h2>
          <div className="text-sm text-gray-500">{trainer.location}</div>
        </div>
      </div>

      <div className="flex justify-center gap-1 mb-4">
        {trainer.pokemon.map((p, i) => (
          <img
            key={i}
            src={spriteUrl(p.species)}
            alt={p.species}
            title={`${p.species} Lv${p.level}`}
            className="w-12 h-12"
          />
        ))}
      </div>

      <div className="text-center mb-4">
        <div className="text-3xl font-mono font-bold text-pokeyellow">{trainer.elo.toFixed(0)}</div>
        <div className="text-xs text-gray-500 uppercase tracking-wider">Elo Rating</div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-900/20 rounded-lg p-2">
          <div className="text-lg font-bold text-green-400">{trainer.win}</div>
          <div className="text-xs text-gray-500">Wins</div>
        </div>
        <div className="bg-red-900/20 rounded-lg p-2">
          <div className="text-lg font-bold text-red-400">{trainer.loss}</div>
          <div className="text-xs text-gray-500">Losses</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2">
          <div className="text-lg font-bold text-gray-400">{trainer.draw}</div>
          <div className="text-xs text-gray-500">Draws</div>
        </div>
      </div>

      <div className="mt-3 text-center text-sm text-gray-400">
        Win rate: <span className="font-semibold text-white">{winPct}%</span>
      </div>

      {trainer.modifiers && trainer.modifiers.length > 0 && (
        <div className="mt-3 text-xs text-gray-500">
          AI Modifiers: {trainer.modifiers.join(', ')}
        </div>
      )}
    </div>
  );
}
