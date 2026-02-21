import { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { getRankings, getMatchups, spriteUrl, trainerSpriteUrl, trainerDisplayName, winRate } from '../data';
import type { TrainerMatchups } from '../data';
import type { RankedTrainer, TournamentMode, Generation } from '../types';
import type { BattleLog } from '../battle-sim';

const BattleReplay = lazy(() => import('../components/BattleReplay'));

interface MatchupRow {
  opponentId: string;
  wins: number;
  losses: number;
  draws: number;
}

export default function TrainerDetail({ gen, mode }: { gen: Generation; mode: TournamentMode }) {
  const { trainerId } = useParams<{ trainerId: string }>();
  const [trainer, setTrainer] = useState<RankedTrainer | null>(null);
  const [allRankings, setAllRankings] = useState<RankedTrainer[]>([]);
  const [matchups, setMatchups] = useState<MatchupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [battlesLoading, setBattlesLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [replayLog, setReplayLog] = useState<BattleLog | null>(null);
  const [replayOpponent, setReplayOpponent] = useState<RankedTrainer | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getRankings(gen, mode).then(rankings => {
      setAllRankings(rankings);
      setTrainer(rankings.find(r => r.id === trainerId) ?? null);
      setLoading(false);
    });
  }, [trainerId, gen, mode]);

  useEffect(() => {
    if (!trainerId) return;
    setBattlesLoading(true);
    getMatchups(gen, mode, trainerId).then(raw => {
      setMatchups(toMatchupRows(raw));
      setBattlesLoading(false);
    });
  }, [trainerId, gen, mode]);

  async function handleWatch(opponentId: string) {
    if (!trainer || (gen !== 2 && gen !== 3)) return;
    const opponent = allRankings.find(r => r.id === opponentId);
    if (!opponent) return;
    setSimulating(opponentId);
    try {
      const { simulateBattle } = await import('../battle-sim');
      const log = await simulateBattle(trainer, opponent, gen);
      setReplayLog(log);
      setReplayOpponent(opponent);
    } finally {
      setSimulating(null);
    }
  }

  if (loading) return <div className="text-xxs text-gb-muted text-center py-8">Loading...</div>;
  if (!trainer) return <div className="text-center py-12 text-gb-muted">Trainer not found.</div>;

  const rank = allRankings.indexOf(trainer) + 1;
  const wr = winRate(trainer);

  return (
    <div className="space-y-6">
      <Link to={`/rankings?${searchParams}`} className="text-xxs text-gb-muted hover:text-gb-dim transition-colors">
        &lt; Back to Rankings
      </Link>

      <div className="gb-card p-4">
        <div className="flex items-start gap-4">
          <img
            src={trainerSpriteUrl(trainer.name, gen, trainer.trainerClass)}
            alt={trainer.name}
            className="w-14 h-14 trainer-sprite"
          />
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <h1 className="text-xs text-gb-text">{trainer.name}</h1>
              <span className="text-xxs text-gb-muted">#{rank}</span>
            </div>
            <div className="text-xxs text-gb-muted mt-0.5">
              {trainer.location}{trainer.trainerClass ? ` · ${trainer.trainerClass}` : ''}
            </div>

            <div className="grid grid-cols-4 gap-3 mt-3">
              <StatBox label="ELO" value={trainer.elo.toFixed(0)} accent />
              <StatBox label="WIN" value={String(trainer.win)} />
              <StatBox label="LOSS" value={String(trainer.loss)} />
              <StatBox label="WIN%" value={`${wr.toFixed(1)}%`} />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              {trainer.bestWin && (
                <div className="border border-gb-border p-2">
                  <div style={{ fontSize: '0.45rem' }} className="text-gb-win mb-1">BEST WIN</div>
                  <Link
                    to={`/trainer/${encodeURIComponent(trainer.bestWin.id)}?${searchParams}`}
                    className="text-xxs text-gb-link hover:text-gb-accent transition-colors"
                  >
                    {trainerDisplayName(trainer.bestWin.id)}
                  </Link>
                  <div className="text-xxs text-gb-accent">{trainer.bestWin.elo.toFixed(0)} Elo</div>
                </div>
              )}
              {trainer.worstLoss && (
                <div className="border border-gb-border p-2">
                  <div style={{ fontSize: '0.45rem' }} className="text-gb-loss mb-1">WORST LOSS</div>
                  <Link
                    to={`/trainer/${encodeURIComponent(trainer.worstLoss.id)}?${searchParams}`}
                    className="text-xxs text-gb-link hover:text-gb-accent transition-colors"
                  >
                    {trainerDisplayName(trainer.worstLoss.id)}
                  </Link>
                  <div className="text-xxs text-gb-accent">{trainer.worstLoss.elo.toFixed(0)} Elo</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AIInfo trainer={trainer} gen={gen} />

      <section>
        <h2 className="text-xxs text-gb-text mb-3">TEAM</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {trainer.pokemon.map((p, i) => (
            <div key={i} className="gb-card p-3 flex gap-3">
              <img src={spriteUrl(p.species, gen)} alt={p.species} className="w-12 h-12" />
              <div>
                <div className="text-xxs text-gb-text">{p.species}</div>
                <div style={{ fontSize: '0.45rem' }} className="text-gb-muted">
                  Lv {p.level}{p.item ? ` — ${p.item}` : ''}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.moves.map((m, j) => (
                    <span key={j} className="text-gb-dim border border-gb-border px-1" style={{ fontSize: '0.4rem' }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xxs text-gb-text mb-3">HEAD-TO-HEAD</h2>
        {battlesLoading ? (
          <div className="text-xxs text-gb-muted text-center py-4">Loading battles...</div>
        ) : (
          <MatchupTable
            matchups={matchups} allRankings={allRankings}
            searchParams={searchParams} gen={gen}
            onWatch={(gen === 2 || gen === 3) ? handleWatch : undefined}
            simulating={simulating}
          />
        )}
      </section>

      {replayLog && replayOpponent && trainer && (
        <Suspense fallback={null}>
          <BattleReplay
            log={replayLog}
            t1={trainer}
            t2={replayOpponent}
            gen={gen}
            onClose={() => { setReplayLog(null); setReplayOpponent(null); }}
          />
        </Suspense>
      )}
    </div>
  );
}

const MOD_NAMES: Record<number, string> = {
  1: 'Status Check',
  2: 'Setup Timing',
  3: 'Type Matchups',
};

function formatItem(item: string | null): string {
  if (!item) return '';
  return item.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bX /g, 'X-');
}

function AIInfo({ trainer, gen }: { trainer: RankedTrainer; gen: Generation }) {
  const hasAI = (gen === 1 && trainer.modifiers && trainer.modifiers.length > 0) ||
    ((gen === 2 || gen === 3) && trainer.aiFlags && trainer.aiFlags.length > 0);
  const hasItemsGen2 = gen === 2 && trainer.trainerItems && (trainer.trainerItems[0] || trainer.trainerItems[1]);
  const hasItemsGen3 = gen === 3 && trainer.items && trainer.items.length > 0;
  const hasItems = hasItemsGen2 || hasItemsGen3;

  if (!hasAI && !hasItems) return null;

  return (
    <section>
      <h2 className="text-xxs text-gb-text mb-3">AI &amp; ITEMS</h2>
      <div className="gb-card p-3 space-y-2">
        {gen === 1 && trainer.modifiers && trainer.modifiers.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-gb-muted" style={{ fontSize: '0.4rem' }}>AI:</span>
            {trainer.modifiers.map(m => (
              <span key={m} className="text-gb-accent border border-gb-border px-1.5 py-0.5" style={{ fontSize: '0.4rem' }}>
                Mod {m}{MOD_NAMES[m] ? ` (${MOD_NAMES[m]})` : ''}
              </span>
            ))}
          </div>
        )}
        {(gen === 2 || gen === 3) && trainer.aiFlags && trainer.aiFlags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-gb-muted" style={{ fontSize: '0.4rem' }}>AI:</span>
            {trainer.aiFlags.map(f => (
              <span key={f} className="text-gb-accent border border-gb-border px-1.5 py-0.5" style={{ fontSize: '0.4rem' }}>
                {f}
              </span>
            ))}
          </div>
        )}
        {gen === 2 && trainer.switchFlag && (
          <div className="flex items-center gap-1.5">
            <span className="text-gb-muted" style={{ fontSize: '0.4rem' }}>Switch:</span>
            <span className="text-gb-dim border border-gb-border px-1.5 py-0.5" style={{ fontSize: '0.4rem' }}>
              {trainer.switchFlag.replace(/_/g, ' ')}
            </span>
          </div>
        )}
        {hasItemsGen2 && (
          <div className="flex items-center gap-1.5">
            <span className="text-gb-muted" style={{ fontSize: '0.4rem' }}>Items:</span>
            {trainer.trainerItems!.filter(Boolean).map((item, i) => (
              <span key={i} className="text-gb-win border border-gb-border px-1.5 py-0.5" style={{ fontSize: '0.4rem' }}>
                {formatItem(item)}
              </span>
            ))}
            {trainer.itemUseFlag && (
              <span className="text-gb-muted" style={{ fontSize: '0.35rem' }}>
                ({trainer.itemUseFlag.replace(/_/g, ' ').toLowerCase()})
              </span>
            )}
          </div>
        )}
        {hasItemsGen3 && (
          <div className="flex items-center gap-1.5">
            <span className="text-gb-muted" style={{ fontSize: '0.4rem' }}>Items:</span>
            {trainer.items!.map((item, i) => (
              <span key={i} className="text-gb-win border border-gb-border px-1.5 py-0.5" style={{ fontSize: '0.4rem' }}>
                {formatItem(item)}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-gb-border p-1.5 text-center">
      <div style={{ fontSize: '0.4rem' }} className="text-gb-muted">{label}</div>
      <div className={`text-xxs ${accent ? 'text-gb-accent' : 'text-gb-text'}`}>{value}</div>
    </div>
  );
}

function toMatchupRows(raw: TrainerMatchups): MatchupRow[] {
  return Object.entries(raw)
    .map(([opponentId, [wins, losses, draws]]) => ({ opponentId, wins, losses, draws }))
    .sort((a, b) => b.wins - a.wins);
}

function MatchupTable({
  matchups, allRankings, searchParams, gen, onWatch, simulating,
}: {
  matchups: MatchupRow[]; allRankings: RankedTrainer[]; searchParams: URLSearchParams; gen: Generation;
  onWatch?: (opponentId: string) => void; simulating?: string | null;
}) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const trainerMap = new Map(allRankings.map(t => [t.id, t]));

  const filtered = search
    ? matchups.filter(row => {
        const opp = trainerMap.get(row.opponentId);
        const name = (opp?.name ?? row.opponentId).toLowerCase();
        return name.includes(search.toLowerCase());
      })
    : matchups;

  const perPage = 20;
  const pages = Math.ceil(filtered.length / perPage);
  const slice = filtered.slice(page * perPage, (page + 1) * perPage);

  return (
    <div>
      <input
        type="text"
        placeholder="Search opponent..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(0); }}
        className="bg-gb-card border border-gb-border text-gb-text text-xxs font-pokemon px-2 py-1.5 w-full mb-2 focus:outline-none focus:border-gb-link transition-colors"
      />
      <div className="gb-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gb-card text-gb-dim" style={{ fontSize: '0.45rem' }}>
              <th className="px-2 py-1.5 text-left">Opponent</th>
              <th className="px-2 py-1.5 text-right">W-L-D</th>
              {onWatch && <th className="px-2 py-1.5 w-12"></th>}
            </tr>
          </thead>
          <tbody>
            {slice.map(row => {
              const opp = trainerMap.get(row.opponentId);
              return (
                <tr key={row.opponentId} className="border-t border-gb-border/40 hover:bg-gb-hover">
                  <td className="px-2 py-1.5">
                    <Link
                      to={`/trainer/${encodeURIComponent(row.opponentId)}?${searchParams}`}
                      className="flex items-center gap-2 hover:text-gb-accent transition-colors"
                    >
                      {opp && (
                        <img src={trainerSpriteUrl(opp.name, gen, opp.trainerClass)} alt="" className="w-5 h-5 trainer-sprite" loading="lazy" />
                      )}
                      <span className="text-xxs text-gb-text">{opp?.name ?? row.opponentId}</span>
                      {opp && <span style={{ fontSize: '0.4rem' }} className="text-gb-muted">{opp.elo.toFixed(0)}</span>}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-right text-xxs">
                    <span className="text-gb-win">{row.wins}</span>
                    <span className="text-gb-muted">-</span>
                    <span className="text-gb-loss">{row.losses}</span>
                    {row.draws > 0 && <span className="text-gb-muted">-{row.draws}</span>}
                  </td>
                  {onWatch && (
                    <td className="px-2 py-1.5 text-center">
                      <button
                        onClick={() => onWatch(row.opponentId)}
                        disabled={simulating === row.opponentId}
                        className="gb-btn text-xxs px-1.5 py-0.5 disabled:opacity-50"
                        style={{ fontSize: '0.4rem' }}
                      >
                        {simulating === row.opponentId ? '...' : 'Watch'}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="gb-btn disabled:opacity-30">Prev</button>
          <span className="text-xxs text-gb-muted">{page + 1}/{pages}{search && ` (${filtered.length} found)`}</span>
          <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1} className="gb-btn disabled:opacity-30">Next</button>
        </div>
      )}
      {search && filtered.length === 0 && (
        <div className="text-xxs text-gb-muted text-center py-3">No matches found.</div>
      )}
    </div>
  );
}
