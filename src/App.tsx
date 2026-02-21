import { Routes, Route, Link, useSearchParams } from 'react-router-dom';
import Home from './pages/Home';
import Rankings from './pages/Rankings';
import TrainerDetail from './pages/TrainerDetail';
import type { TournamentMode, Generation } from './types';

function ModeToggle({ mode, setMode }: { mode: TournamentMode; setMode: (m: TournamentMode) => void }) {
  return (
    <div className="flex gap-1">
      <button className={`gb-btn ${mode === '' ? 'active' : ''}`} onClick={() => setMode('')}>Normal</button>
      <button className={`gb-btn ${mode === '-lv50' ? 'active' : ''}`} onClick={() => setMode('-lv50')}>Lv 50</button>
    </div>
  );
}

function GenToggle({ gen, setGen }: { gen: Generation; setGen: (g: Generation) => void }) {
  return (
    <div className="flex gap-1">
      <button className={`gb-btn ${gen === 1 ? 'active' : ''}`} onClick={() => setGen(1)}>Gen I</button>
      <button className={`gb-btn ${gen === 2 ? 'active' : ''}`} onClick={() => setGen(2)}>Gen II</button>
    </div>
  );
}

export default function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = (searchParams.get('mode') === 'lv50' ? '-lv50' : '') as TournamentMode;
  const gen = (searchParams.get('gen') === '2' ? 2 : 1) as Generation;

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next);
  };

  const setMode = (m: TournamentMode) => updateParams({ mode: m === '-lv50' ? 'lv50' : null! });
  const setGen = (g: Generation) => updateParams({ gen: g === 2 ? '2' : null! });

  const qs = searchParams.toString();
  const qsSuffix = qs ? `?${qs}` : '';

  return (
    <div className="min-h-screen">
      <nav className="border-b-2 border-gb-border bg-gb-bg/95 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/${qsSuffix}`} className="text-gb-accent text-xs hover:text-gb-text transition-colors">
              POKeTOURNAMENT
            </Link>
            <div className="flex gap-3 text-xxs">
              <Link to={`/${qsSuffix}`} className="text-gb-dim hover:text-gb-text transition-colors">Home</Link>
              <Link to={`/rankings${qsSuffix}`} className="text-gb-dim hover:text-gb-text transition-colors">Rankings</Link>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GenToggle gen={gen} setGen={setGen} />
            <ModeToggle mode={mode} setMode={setMode} />
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Home gen={gen} mode={mode} />} />
          <Route path="/rankings" element={<Rankings gen={gen} mode={mode} />} />
          <Route path="/trainer/:trainerId" element={<TrainerDetail gen={gen} mode={mode} />} />
        </Routes>
      </main>
    </div>
  );
}
