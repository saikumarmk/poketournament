import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getRankings, spriteUrl, trainerSpriteUrl, winRate } from '../data';
import type { RankedTrainer, TournamentMode, Generation } from '../types';

export default function Rankings({ gen, mode }: { gen: Generation; mode: TournamentMode }) {
  const [rankings, setRankings] = useState<RankedTrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setLoading(true);
    getRankings(gen, mode).then(r => { setRankings(r); setLoading(false); }).catch(() => setLoading(false));
  }, [gen, mode]);

  const filtered = rankings.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.location.toLowerCase().includes(search.toLowerCase()) ||
    (t.trainerClass ?? '').toLowerCase().includes(search.toLowerCase()) ||
    t.pokemon.some(p => p.species.toLowerCase().includes(search.toLowerCase())),
  );

  const genLabel = gen === 3 ? 'Gen III' : gen === 2 ? 'Gen II' : 'Gen I';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xxs text-gb-text">
          {genLabel} RANKINGS{mode === '-lv50' ? ' (LV50)' : ''}
        </h1>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gb-card border-2 border-gb-border text-gb-text text-xxs font-pokemon px-2 py-1.5 w-48 focus:outline-none focus:border-gb-link transition-colors"
        />
      </div>

      {loading ? (
        <div className="text-xxs text-gb-muted text-center py-8">Loading...</div>
      ) : rankings.length === 0 ? (
        <div className="text-xxs text-gb-muted text-center py-8">No data available for this mode yet.</div>
      ) : (
        <div className="gb-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gb-card text-gb-dim" style={{ fontSize: '0.5rem' }}>
                <th className="px-2 py-1.5 text-right w-8">#</th>
                <th className="px-2 py-1.5 text-left">Trainer</th>
                <th className="px-2 py-1.5 text-left">Team</th>
                <th className="px-2 py-1.5 text-right">Elo</th>
                <th className="px-2 py-1.5 text-right">W/L</th>
                <th className="px-2 py-1.5 text-right">Win%</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const rank = rankings.indexOf(t) + 1;
                const wr = winRate(t);
                return (
                  <tr key={t.id} className="border-t border-gb-border/40 hover:bg-gb-hover transition-colors">
                    <td className="px-2 py-1.5 text-right text-gb-muted text-xxs">{rank}</td>
                    <td className="px-2 py-1.5">
                      <Link
                        to={`/trainer/${encodeURIComponent(t.id)}?${searchParams}`}
                        className="flex items-center gap-2 hover:text-gb-accent transition-colors"
                      >
                        <img
                          src={trainerSpriteUrl(t.name, gen, t.trainerClass)}
                          alt={t.name}
                          className="w-7 h-7 trainer-sprite"
                          loading="lazy"
                        />
                        <div>
                          <div className="text-xxs text-gb-text">{t.name}</div>
                          <div style={{ fontSize: '0.45rem' }} className="text-gb-muted">{t.location}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex -space-x-1">
                        {t.pokemon.map((p, j) => (
                          <img
                            key={j}
                            src={spriteUrl(p.species, gen)}
                            alt={p.species}
                            title={`${p.species} Lv${p.level}`}
                            className="w-6 h-6"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right text-xxs text-gb-accent">{t.elo.toFixed(0)}</td>
                    <td className="px-2 py-1.5 text-right text-xxs">
                      <span className="text-gb-win">{t.win}</span>
                      <span className="text-gb-muted">/</span>
                      <span className="text-gb-loss">{t.loss}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-xxs text-gb-text">{wr.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
