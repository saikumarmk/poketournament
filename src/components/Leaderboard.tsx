import { Link } from 'react-router-dom';
import { spriteUrl } from '../data';
import type { RankedTrainer } from '../types';

interface Props {
  trainers: RankedTrainer[];
  limit?: number;
}

export default function Leaderboard({ trainers, limit }: Props) {
  const shown = limit ? trainers.slice(0, limit) : trainers;

  return (
    <div className="space-y-2">
      {shown.map((t, i) => {
        const rank = i + 1;
        const medalColor = rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : rank === 3 ? 'text-orange-400' : 'text-gray-600';
        return (
          <Link
            key={t.id}
            to={`/trainer/${encodeURIComponent(t.id)}`}
            className="flex items-center gap-3 bg-gray-900 rounded-lg border border-gray-800 px-3 py-2 hover:border-gray-600 transition-colors"
          >
            <span className={`font-bold text-sm w-6 text-right ${medalColor}`}>{rank}</span>
            <div className="flex -space-x-1">
              {t.pokemon.slice(0, 2).map((p, j) => (
                <img key={j} src={spriteUrl(p.species)} alt="" className="w-6 h-6 rounded-full bg-gray-800 border border-gray-900" loading="lazy" />
              ))}
            </div>
            <div className="flex-1 min-w-0 truncate text-sm font-medium">{t.name}</div>
            <span className="font-mono text-sm font-bold text-pokeyellow">{t.elo.toFixed(0)}</span>
          </Link>
        );
      })}
    </div>
  );
}
