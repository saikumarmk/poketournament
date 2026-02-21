import type { RankedTrainer, TournamentMode, Generation } from './types';

export type TrainerMatchups = Record<string, [number, number, number]>;

interface IndexedMatchups {
  idx: string[];
  data: [number, number, number][];
}

const rankingsCache: Record<string, RankedTrainer[]> = {};
const matchupsCache: Record<string, IndexedMatchups> = {};

function dataSuffix(gen: Generation, mode: TournamentMode): string {
  const genPart = gen === 2 ? '-gen2' : '';
  return `${genPart}${mode}`;
}

export async function getRankings(gen: Generation, mode: TournamentMode): Promise<RankedTrainer[]> {
  const key = `${gen}${mode}`;
  if (rankingsCache[key]) return rankingsCache[key];
  const res = await fetch(`/data/rankings${dataSuffix(gen, mode)}.json`, { cache: 'no-store' });
  if (!res.ok) return [];
  rankingsCache[key] = await res.json();
  return rankingsCache[key];
}

async function loadMatchups(gen: Generation, mode: TournamentMode): Promise<IndexedMatchups> {
  const key = `${gen}${mode}`;
  if (matchupsCache[key]) return matchupsCache[key];
  const res = await fetch(`/data/matchups${dataSuffix(gen, mode)}.json`, { cache: 'no-store' });
  if (!res.ok) return { idx: [], data: [] };
  matchupsCache[key] = await res.json();
  return matchupsCache[key];
}

export async function getMatchups(
  gen: Generation, mode: TournamentMode, trainerId: string,
): Promise<TrainerMatchups> {
  const { idx, data } = await loadMatchups(gen, mode);
  const N = idx.length;
  const i = idx.indexOf(trainerId);
  if (i === -1 || N === 0) return {};

  const result: TrainerMatchups = {};
  for (let j = 0; j < N; j++) {
    if (j === i) continue;
    const entry = data[i * N + j];
    if (entry[0] === 0 && entry[1] === 0 && entry[2] === 0) continue;
    result[idx[j]] = entry;
  }
  return result;
}

export function spriteUrl(species: string, gen: Generation = 1): string {
  const id = species.toLowerCase().replace(/[^a-z0-9]/g, '');
  const genStr = gen === 2 ? 'gen2' : 'gen1';
  return `https://play.pokemonshowdown.com/sprites/${genStr}/${id}.png`;
}

const TYPE_COLORS: Record<string, string> = {
  Normal: '#A8A878', Fire: '#F08030', Water: '#6890F0', Electric: '#F8D030',
  Grass: '#78C850', Ice: '#98D8D8', Fighting: '#C03028', Poison: '#A040A0',
  Ground: '#E0C068', Flying: '#A890F0', Psychic: '#F85888', Bug: '#A8B820',
  Rock: '#B8A038', Ghost: '#705898', Dragon: '#7038F8',
  Dark: '#705848', Steel: '#B8B8D0',
};

export function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? '#888888';
}

const GEN1_SPRITE_MAP: Record<string, string> = {
  Youngster: 'youngster', BugCatcher: 'bugcatcher', Lass: 'lass',
  Sailor: 'sailor', JrTrainerM: 'jr.trainerm', JrTrainerF: 'jr.trainerf',
  Pokemaniac: 'pokemaniac', SuperNerd: 'supernerd', Hiker: 'hiker',
  Biker: 'biker', Burglar: 'burglar', Engineer: 'engineer',
  UnusedJuggler: 'juggler', Fisher: 'fisher', Swimmer: 'swimmer',
  CueBall: 'cueball', Gambler: 'gambler', Beauty: 'beauty',
  Psychic: 'psychic', Rocker: 'rocker', Juggler: 'juggler',
  Tamer: 'tamer', BirdKeeper: 'birdkeeper', Blackbelt: 'blackbelt',
  Rival1: 'rival1', ProfOak: 'prof.oak', Chief: 'scientist',
  Scientist: 'scientist', Giovanni: 'giovanni', Rocket: 'rocket',
  CooltrainerM: 'cooltrainerm', CooltrainerF: 'cooltrainerf',
  Bruno: 'bruno', Brock: 'brock', Misty: 'misty',
  LtSurge: 'lt.surge', Erika: 'erika', Koga: 'koga',
  Blaine: 'blaine', Sabrina: 'sabrina', Gentleman: 'gentleman',
  Rival2: 'rival2', Rival3: 'rival3', Lorelei: 'lorelei',
  Channeler: 'channeler', Agatha: 'agatha', Lance: 'lance',
};

const GEN2_SPRITE_MAP: Record<string, string> = {
  // Gym leaders
  FALKNER: 'falkner', BUGSY: 'bugsy', WHITNEY: 'whitney', MORTY: 'morty',
  CHUCK: 'chuck', JASMINE: 'jasmine', PRYCE: 'pryce', CLAIR: 'clair',
  // Kanto gym leaders
  BROCK: 'brock', MISTY: 'misty', LT_SURGE: 'lt_surge', ERIKA: 'erika',
  SABRINA: 'sabrina', JANINE: 'janine', BLAINE: 'blaine', BLUE: 'blue',
  // Elite Four + Champion
  WILL: 'will', KOGA: 'koga', BRUNO: 'bruno', KAREN: 'karen', CHAMPION: 'champion',
  // Special
  RIVAL1: 'rival1', RIVAL2: 'rival2', RED: 'red', CAL: 'cal',
  POKEMON_PROF: 'oak', MYSTICALMAN: 'mysticalman',
  // Rocket
  GRUNTM: 'grunt_m', GRUNTF: 'grunt_f',
  EXECUTIVEM: 'executive_m', EXECUTIVEF: 'executive_f',
  // Regular trainer classes
  YOUNGSTER: 'youngster', SCHOOLBOY: 'schoolboy', LASS: 'lass',
  COOLTRAINERM: 'cooltrainer_m', COOLTRAINERF: 'cooltrainer_f',
  BEAUTY: 'beauty', POKEMANIAC: 'pokemaniac', GENTLEMAN: 'gentleman',
  SKIER: 'skier', TEACHER: 'teacher', BUG_CATCHER: 'bug_catcher',
  FISHER: 'fisher', SWIMMERM: 'swimmer_m', SWIMMERF: 'swimmer_f',
  SAILOR: 'sailor', SUPER_NERD: 'super_nerd', GUITARIST: 'guitarist',
  HIKER: 'hiker', BIKER: 'biker', BURGLAR: 'burglar', SCIENTIST: 'scientist',
  FIREBREATHER: 'firebreather', JUGGLER: 'juggler',
  BLACKBELT_T: 'blackbelt_t', PSYCHIC_T: 'psychic_t',
  BIRD_KEEPER: 'bird_keeper', PICNICKER: 'picnicker', CAMPER: 'camper',
  SAGE: 'sage', MEDIUM: 'medium', BOARDER: 'boarder',
  POKEFANM: 'pokefan_m', POKEFANF: 'pokefan_f',
  KIMONO_GIRL: 'kimono_girl', TWINS: 'twins', OFFICER: 'officer',
};

export function trainerSpriteUrl(trainerName: string, gen: Generation = 1, trainerClass?: string): string {
  if (gen === 2 && trainerClass) {
    const key = GEN2_SPRITE_MAP[trainerClass];
    if (key) return `/sprites/trainers-gen2/${key}.png`;
    return `/sprites/trainers-gen2/youngster.png`;
  }
  const key = GEN1_SPRITE_MAP[trainerName];
  if (key) return `/sprites/trainers/${key}.png`;
  return `/sprites/trainers/youngster.png`;
}

export function trainerDisplayName(id: string): string {
  const [name, ...rest] = id.split('-');
  const loc = rest.join('-');
  return `${name} (${loc})`;
}

export function winRate(t: RankedTrainer): number {
  const total = t.win + t.loss + t.draw;
  return total > 0 ? (t.win / total) * 100 : 0;
}
