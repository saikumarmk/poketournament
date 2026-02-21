import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getRankings, spriteUrl, trainerSpriteUrl } from '../data';
import type { RankedTrainer, TournamentMode, Generation } from '../types';

export default function Home({ gen, mode }: { gen: Generation; mode: TournamentMode }) {
  const [rankings, setRankings] = useState<RankedTrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    setLoading(true);
    getRankings(gen, mode).then(r => { setRankings(r); setLoading(false); }).catch(() => setLoading(false));
  }, [gen, mode]);

  if (loading) return <div className="text-xxs text-gb-muted text-center py-8">Loading tournament data...</div>;

  const top10 = rankings.slice(0, 10);
  const totalBattles = rankings.reduce((sum, t) => sum + t.win + t.loss + t.draw, 0) / 2;
  const genLabel = gen === 3 ? 'Emerald' : gen === 2 ? 'Crystal' : 'Red';
  const whitneyIdx = rankings.findIndex(r => r.name === 'WHITNEY');
  const whitneyRank = whitneyIdx >= 0 ? whitneyIdx + 1 : null;
  const topTotal = rankings[0] ? rankings[0].win + rankings[0].loss + rankings[0].draw : 0;

  return (
    <div className="space-y-8">
      <section className="text-center py-6">
        <h1 className="text-sm text-gb-accent mb-4 leading-relaxed">
          POKeMON {genLabel.toUpperCase()}<br/>TRAINER TOURNAMENT
        </h1>
        {rankings.length > 0 ? (
          <p className="font-readable text-gb-dim max-w-lg mx-auto">
            What happens when every single trainer in Pok&eacute;mon {genLabel} fights
            every other trainer?{' '}
            <span className="text-gb-text">
              {rankings.length} trainers. {totalBattles.toLocaleString()} battles.
            </span>
            {mode === '-lv50' && <span className="text-gb-accent"> All Pok&eacute;mon set to Lv50.</span>}
            {mode === '' && <span> Original in-game levels. No mercy.</span>}
          </p>
        ) : (
          <p className="text-xxs text-gb-muted">No data available for this mode yet.</p>
        )}
      </section>

      <section className="gb-card p-4 space-y-3 font-readable">
        <h2 className="text-xxs text-gb-accent font-pokemon">THE EXPERIMENT</h2>
        <p className="text-gb-dim">
          Every in-game trainer &mdash; from the rival&apos;s Lv5 starter on Route 1 all the
          way to the Champion &mdash; is extracted directly from the{' '}
          {gen === 3
            ? <a href="https://github.com/pret/pokeemerald" className="text-gb-link hover:text-gb-accent" target="_blank" rel="noreferrer">pokeemerald</a>
            : gen === 2
            ? <a href="https://github.com/pret/pokecrystal" className="text-gb-link hover:text-gb-accent" target="_blank" rel="noreferrer">pokecrystal</a>
            : <a href="https://github.com/pret/pokered" className="text-gb-link hover:text-gb-accent" target="_blank" rel="noreferrer">pokered</a>
          }{' '}
          disassembly (the actual game source code). Their teams, movesets, levels, and AI
          behavior are all preserved exactly as in the cartridge. Nothing is hand-entered.
        </p>
        <p className="text-gb-dim">
          Then they fight. Every trainer battles every other trainer once, using the same
          battle engine and AI logic the game uses internally. Results are ranked with
          logistic regression Elo.
        </p>
        {gen === 1 ? (
          <p className="text-gb-dim">
            Some highlights: <span className="text-gb-text">Prof. Oak</span>&apos;s unused
            battle teams (datamined from the ROM!) dominate the rankings with squads like
            Tauros/Exeggutor/Arcanine/Gyarados. <span className="text-gb-text">Agatha</span> is
            the strongest E4 member thanks to her double-Gengar sleep onslaught.
            Your Rival&apos;s opening Lv5 starter sits dead last at #{rankings.length}.
          </p>
        ) : gen === 2 ? (
          <p className="text-gb-dim">
            Some highlights: <span className="text-gb-text">RED</span> sits at the top with
            his iconic team (Pikachu, Espeon, Snorlax, all three starters) &mdash; he lost
            just 1 battle out of {topTotal}.{' '}
            <span className="text-gb-text">JOEY</span>&apos;s Rattata is in last place &mdash;
            turns out it wasn&apos;t really in the top percentage after all.
            {whitneyRank && (<>
              {' '}And <span className="text-gb-text">Whitney</span>&apos;s Miltank, every
              player&apos;s nightmare, lands at #{whitneyRank} &mdash; terrifying to a
              10-year-old, mid-tier against 540 other trainers.
            </>)}
          </p>
        ) : (
          <p className="text-gb-dim">
            Some highlights: <span className="text-gb-text">STEVEN</span> &mdash; the post-game
            boss in Meteor Falls &mdash; is completely undefeated with his
            Skarmory/Claydol/Aggron/Cradily/Armaldo/Metagross squad.{' '}
            <span className="text-gb-text">Champion WALLACE</span> is #2, and the entire{' '}
            <span className="text-gb-text">Elite Four</span> (Glacia, Drake, Phoebe, Sidney)
            fills out the top 8. Route 104&apos;s DARIAN sits at #{rankings.length} with a
            single Zigzagoon.
            The famous <code className="text-gb-accent">GetMostSuitableMonToSwitchInto</code> bug
            means switching often picks the worst defensive typing instead of the best.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Tag label={`${rankings.length} TRAINERS`} />
          <Tag label={`${totalBattles.toLocaleString()} BATTLES`} />
          <Tag label="PARSED FROM ASM" />
        </div>
      </section>

      <section className="gb-card p-4 space-y-3 font-readable">
        <h2 className="text-xxs text-gb-accent font-pokemon">
          HOW THE {gen === 3 ? 'GEN III' : gen === 2 ? 'GEN II' : 'GEN I'} AI ACTUALLY WORKS
        </h2>
        {gen === 3 ? <Gen3AI /> : gen === 2 ? <Gen2AI /> : <Gen1AI />}
      </section>

      <section className="gb-card p-4 space-y-3 font-readable">
        <h2 className="text-xxs text-gb-accent font-pokemon">TWO WAYS TO FIGHT</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="border border-gb-border p-3">
            <div className="text-gb-text font-pokemon text-xxs mb-1">Normal Mode</div>
            <p className="text-gb-dim">
              {gen === 3
                ? "Original in-game levels. Steven\u2019s Lv77 Metagross and Wallace\u2019s Lv58 Milotic steamroll early-route teams. The entire Elite Four occupies the top 8. Level advantage and 6-mon squads dominate."
                : gen === 2
                ? "Original in-game levels. RED\u2019s Lv81 Pikachu steamrolls Lv4 Rattatas, as nature intended. Lance\u2019s triple Dragonite tears through early-game trainers. Level advantage dominates."
                : "Original in-game levels. Prof. Oak\u2019s Lv70 Gyarados steamrolls Brock\u2019s Lv12 Geodude. Lance\u2019s Lv62 Dragonite tears through early-route trainers. The level curve is brutal."}
            </p>
          </div>
          <div className="border border-gb-border p-3">
            <div className="text-gb-text font-pokemon text-xxs mb-1">Level 50 Mode</div>
            <p className="text-gb-dim">
              {gen === 3
                ? "All Pok\u00e9mon set to Lv50. The great equalizer. Wallace goes undefeated \u2014 his 6-mon Water squad is untouchable when levels are even. Gym Leaders like Norman and Winona crack the top 10. Wally\u2019s early-game Ralts is near dead last."
                : gen === 2
                ? "All Pok\u00e9mon set to Lv50. The great equalizer. Now it\u2019s pure team composition and AI. Whitney\u2019s Miltank jumps almost 200 ranks. Bugsy\u2019s Metapod/Kakuna dead weight still drags him down."
                : "All Pok\u00e9mon set to Lv50. The great equalizer. Now it\u2019s pure team comp and AI quality. Agatha\u2019s double Gengar + sleep strats push her to #1. Team diversity matters."}
            </p>
          </div>
        </div>
      </section>

      {(gen === 2 || gen === 3) && (
        <section className="gb-card p-4 space-y-3 font-readable">
          <h2 className="text-xxs text-gb-accent font-pokemon">WATCH ANY BATTLE</h2>
          <p className="text-gb-dim">
            Every battle can be replayed turn by turn in the browser. Click any trainer,
            find an opponent in their head-to-head table, and hit{' '}
            <span className="text-gb-text">Watch</span>. The full battle engine runs
            client-side with the complete AI &mdash; scoring layers, switching logic, item
            usage, all of it. The same deterministic seed means you&apos;ll see the exact same
            battle that produced the tournament result.
          </p>
          {gen === 2 && (
            <p className="text-gb-dim">
              Want to see Karen&apos;s Umbreon set up on Will&apos;s Xatu? Or Lance&apos;s
              Dragonite sweep through Falkner&apos;s team? Every matchup is replayable.
            </p>
          )}
          {gen === 3 && (
            <p className="text-gb-dim">
              Watch Steven&apos;s Metagross bulldoze route trainers, or see how the
              <code className="text-gb-accent"> GetMostSuitableMonToSwitchInto</code> bug
              makes the AI swap to the worst possible counter. All 9 scoring scripts,
              abilities, weather, and up to 4 items per trainer &mdash; running live.
            </p>
          )}
        </section>
      )}

      {top10.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xxs text-gb-text">TOP 10 TRAINERS</h2>
            <Link to={`/rankings?${searchParams}`} className="text-xxs text-gb-link hover:text-gb-text transition-colors">
              View all {rankings.length} &gt;
            </Link>
          </div>
          <div className="grid gap-2">
            {top10.map((trainer, i) => (
              <Link key={trainer.id} to={`/trainer/${encodeURIComponent(trainer.id)}?${searchParams}`} className="gb-card flex items-center gap-3 p-3 transition-colors">
                <div className="text-xxs text-gb-muted w-6 text-right">{i + 1}</div>
                <img src={trainerSpriteUrl(trainer.name, gen, trainer.trainerClass)} alt={trainer.name} className="w-10 h-10 trainer-sprite" loading="lazy" />
                <div className="flex -space-x-1">
                  {trainer.pokemon.slice(0, 3).map((p, j) => (
                    <img key={j} src={spriteUrl(p.species, gen)} alt={p.species} className="w-8 h-8" loading="lazy" />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xxs text-gb-text truncate">{trainer.name}</div>
                  <div className="text-xxs text-gb-muted">{trainer.location}</div>
                </div>
                <div className="text-right">
                  <div className="text-xxs text-gb-accent">{trainer.elo.toFixed(0)}</div>
                  <div className="text-xxs text-gb-muted">{trainer.win}W {trainer.loss}L</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-gb-border/30 pt-4 space-y-2">
        <p className="text-gb-muted text-center font-readable" style={{ fontSize: '0.35rem' }}>
          Gen I: <a href="https://github.com/pkmn/engine" className="text-gb-link" target="_blank" rel="noreferrer">@pkmn/engine</a> (Zig)
          {' \u00b7 '}Gen II: <a href="https://github.com/pkmn/ps" className="text-gb-link" target="_blank" rel="noreferrer">@pkmn/sim</a>
          {' \u00b7 '}React + Vite + Tailwind
          {' \u00b7 '}Data: <a href="https://github.com/pret/pokered" className="text-gb-link" target="_blank" rel="noreferrer">pokered</a>
          {' / '}<a href="https://github.com/pret/pokecrystal" className="text-gb-link" target="_blank" rel="noreferrer">pokecrystal</a>
          {' / '}<a href="https://github.com/pret/pokeemerald" className="text-gb-link" target="_blank" rel="noreferrer">pokeemerald</a>
        </p>
      </section>
    </div>
  );
}

function Gen1AI() {
  return (
    <div className="space-y-3">
      <p className="text-gb-dim">
        Pok&eacute;mon Red&apos;s AI is famously simple. Each trainer class gets up to
        three <span className="text-gb-text">modifier functions</span> that nudge move
        priorities. That&apos;s it &mdash; no damage calculation, no switching, no items.
        Every move starts at priority 10 (higher = better), and modifiers push scores
        up or down by 1&ndash;5.
      </p>

      <div className="space-y-3">
        <Layer name="Mod 1 &mdash; Status Check" score="+5 penalty">
          <p className="text-gb-dim">
            Penalizes status moves if the opponent already has a status condition.
            If the opponent is paralyzed, Stun Spore gets +5 penalty. Without this modifier,
            trainers happily try to paralyze an already-paralyzed Pok&eacute;mon.
          </p>
          <MoveList label="Affected moves" moves={[
            'Thunder Wave', 'Glare', 'Stun Spore', 'Toxic', 'Poison Powder',
            'Poison Gas', 'Spore', 'Sleep Powder', 'Sing', 'Hypnosis', 'Lovely Kiss',
          ]} />
        </Layer>

        <Layer name="Mod 2 &mdash; Setup Timing" score="-1 on turn 2">
          <p className="text-gb-dim">
            Slightly prefers buff and status moves on turn 2. This is actually a
            bug in the original game &mdash; the code checks if turn equals 1, but
            it&apos;s off by one. We reproduce the bug faithfully.
          </p>
          <MoveList label="Affected moves" moves={[
            'Meditate', 'Sharpen', 'Defense Curl', 'Harden', 'Withdraw', 'Growth',
            'Double Team', 'Minimize', 'Swords Dance', 'Acid Armor', 'Barrier',
            'Agility', 'Amnesia', 'Recover', 'Rest', 'Softboiled', 'Light Screen',
            'Reflect', 'Screech', 'Growl', 'Leer', 'Tail Whip', 'String Shot',
            'Flash', 'Kinesis', 'Sand Attack', 'Smokescreen', 'Haze', 'Transform',
          ]} />
        </Layer>

        <Layer name="Mod 3 &mdash; Type Matchups" score="-1 / +1">
          <p className="text-gb-dim">
            Favors super-effective moves (-1), penalizes not-very-effective (+1)
            when a better option exists. Uses the Gen I type chart. This separates
            Lance from a Bug Catcher &mdash; Lance has Mod 3, so his Dragonite picks
            the super-effective move. Bug Catchers don&apos;t, so they Harden into oblivion.
          </p>
        </Layer>
      </div>

      <p className="text-gb-dim">
        That&apos;s the entire AI. <span className="text-gb-text">Lorelei</span> is the only
        E4 member with all three modifiers. Most gym leaders only get Mod 1 + Mod 3 &mdash;
        they know type matchups but don&apos;t set up. Bruno only has Mod 1, which means his
        Machamp literally picks moves at random among non-status options.
      </p>

      <div className="border border-gb-border/50 p-3">
        <div className="text-gb-muted mb-1 font-pokemon" style={{ fontSize: '0.4rem' }}>EXAMPLE</div>
        <p className="text-gb-dim">
          <span className="text-gb-text">Sabrina</span> (Mods 1+3) vs a Water-type: her
          Alakazam has Psychic, Recover, Psywave, and Reflect. Mod 3 pushes Psychic&apos;s
          priority up for type advantage, but she has no concept of &quot;Psychic does the
          most damage&quot; &mdash; that would require a damage calculator the Gen I AI
          simply doesn&apos;t have.
        </p>
      </div>

      <p className="text-gb-dim">
        Battles run on <span className="text-gb-text">@pkmn/engine</span>, a Zig-based
        Gen I engine that reproduces original mechanics including the Focus Energy bug
        (divides crit rate instead of multiplying), the 1/256 miss chance on
        &quot;100% accuracy&quot; moves, and Hyper Beam not recharging after a KO.
      </p>
    </div>
  );
}

function Gen2AI() {
  return (
    <div className="space-y-3">
      <p className="text-gb-dim">
        Gen II completely overhauled the trainer AI. Crystal uses a{' '}
        <span className="text-gb-text">scoring system</span> with{' '}
        <span className="text-gb-text">10 layers</span> of evaluation. Every move starts
        at score <span className="text-gb-accent">20</span> (lower is better). Each layer
        adds or subtracts based on battle state. The lowest-scoring move is chosen &mdash;
        ties broken randomly.
      </p>
      <p className="text-gb-dim">
        Each trainer class has a <span className="text-gb-text">bitmask</span> controlling
        which layers are active. JOEY&apos;s Youngster class gets 6 layers. Gym leaders
        and E4 get 7. The combination matters &mdash; even which layers you{' '}
        <em>don&apos;t</em> have changes behavior.
      </p>

      <div className="space-y-3">
        <Layer name="AI_BASIC" score="+10 dismiss">
          <p className="text-gb-dim">
            The sanity check. Prevents obviously wasted turns by dismissing moves that
            can&apos;t work. Dream Eater on an awake target? Dismissed. Reflect already
            up? Dismissed. Target already poisoned? Don&apos;t Toxic again.
          </p>
          <ul className="text-gb-muted list-disc pl-4 space-y-0.5">
            <li>Dream Eater, Nightmare &rarr; dismissed if target not asleep</li>
            <li>Heal/Recover/Synthesis/Moonlight &rarr; dismissed at full HP</li>
            <li>Light Screen, Reflect, Mist, Safeguard &rarr; dismissed if already active</li>
            <li>Confusion moves &rarr; dismissed if target confused or has Safeguard</li>
            <li>Substitute &rarr; dismissed if sub already up</li>
            <li>Leech Seed &rarr; dismissed if target already seeded</li>
            <li>Weather moves &rarr; dismissed if weather already matches</li>
            <li>Attract &rarr; dismissed if same gender or genderless</li>
            <li>Snore/Sleep Talk &rarr; dismissed if not asleep; strongly encouraged if asleep</li>
          </ul>
          <MoveList label="Status moves dismissed if target has any status" moves={[
            'Sing', 'Sleep Powder', 'Hypnosis', 'Lovely Kiss', 'Spore',
            'Toxic', 'Poison Powder', 'Poison Gas',
            'Thunder Wave', 'Stun Spore', 'Glare',
          ]} />
        </Layer>

        <Layer name="AI_SETUP" score="-2 or +2">
          <p className="text-gb-dim">
            Turn-based timing for stat moves. On turn 1, stat-up moves get 50% chance of
            -2 (encouraged). After turn 1, 90% chance of +2 (discouraged). Same for
            stat-down moves. This makes gym leaders sometimes open with Swords Dance but
            not keep stacking boosts endlessly.
          </p>
          <MoveList label="Stat-up moves" moves={[
            'Swords Dance', 'Growth', 'Meditate', 'Agility', 'Double Team',
            'Harden', 'Minimize', 'Withdraw', 'Defense Curl', 'Barrier',
            'Amnesia', 'Acid Armor', 'Sharpen',
          ]} />
          <MoveList label="Stat-down moves" moves={[
            'Growl', 'Leer', 'Tail Whip', 'String Shot', 'Screech',
            'Cotton Spore', 'Charm', 'Scary Face', 'Sweet Scent',
          ]} />
        </Layer>

        <Layer name="AI_TYPES" score="-1 / +1 / +10">
          <p className="text-gb-dim">
            Type matchup awareness. Super-effective: -1. Not-very-effective: +1 (if another
            damaging move of different type exists). Immune: +10 (dismissed). Stops
            Lance&apos;s Dragonite from using Normal moves against a Ghost.
          </p>
        </Layer>

        <Layer name="AI_OFFENSIVE" score="+2">
          <p className="text-gb-dim">
            All non-damaging moves (power = 0) get +2. Constant pressure toward attacking.
            Without this, the AI would weigh Growl and Earthquake equally.
          </p>
        </Layer>

        <Layer name="AI_SMART" score="varies (-10 to +30)">
          <p className="text-gb-dim">
            The big one &mdash; ~40 move-specific handlers. This is where the AI stops
            feeling random and starts feeling strategic.
          </p>
          <ul className="text-gb-muted list-disc pl-4 space-y-0.5">
            <li><span className="text-gb-text">Sleep moves</span> &rarr; -1 if team has Dream Eater/Nightmare</li>
            <li><span className="text-gb-text">Dream Eater</span> &rarr; -5 (90%) if target asleep</li>
            <li><span className="text-gb-text">Self-Destruct</span> &rarr; +10 unless last mon vs last mon at low HP</li>
            <li><span className="text-gb-text">Heal moves</span> &rarr; -1 (90%) if HP &lt; 25%; +1 if HP &gt; 50%</li>
            <li><span className="text-gb-text">Toxic/Leech Seed</span> &rarr; +1 if target HP &lt; 50%</li>
            <li><span className="text-gb-text">OHKO moves</span> &rarr; +10 if target higher level; +1 if target HP &lt; 50%</li>
            <li><span className="text-gb-text">Hyper Beam</span> &rarr; +1 at high HP; 50% -1 at low HP</li>
            <li><span className="text-gb-text">Encore</span> &rarr; -5 if faster and target used setup; +10 if slower</li>
            <li><span className="text-gb-text">Rain Dance</span> &rarr; -1 if team has Water moves; +1 if target does</li>
            <li><span className="text-gb-text">Sunny Day</span> &rarr; -1 if team has Fire moves; +1 if target does</li>
            <li><span className="text-gb-text">Solar Beam</span> &rarr; -1 in sun; +1 in rain</li>
            <li><span className="text-gb-text">Sacred Fire</span> &rarr; -10 if target is frozen</li>
            <li><span className="text-gb-text">Pursuit</span> &rarr; 50% -5 if target HP &lt; 25%; else 80% +1</li>
            <li><span className="text-gb-text">Protect</span> &rarr; -1 vs charged moves; +1 if already used once</li>
            <li><span className="text-gb-text">Counter</span> &rarr; -1 if last move was physical</li>
            <li><span className="text-gb-text">Thief</span> &rarr; +30 (almost never used)</li>
          </ul>
          <MoveList label="Rain Dance combo moves" moves={[
            'Water Gun', 'Hydro Pump', 'Surf', 'Bubble Beam', 'Thunder',
            'Waterfall', 'Crabhammer', 'Octazooka', 'Whirlpool',
          ]} />
          <MoveList label="Sunny Day combo moves" moves={[
            'Fire Punch', 'Ember', 'Flamethrower', 'Fire Spin', 'Fire Blast',
            'Sacred Fire', 'Morning Sun', 'Synthesis',
          ]} />
          <MoveList label="Encore targets" moves={[
            'Swords Dance', 'Whirlwind', 'Leer', 'Roar', 'Disable', 'Mist',
            'Leech Seed', 'Growth', 'Poison Powder', 'String Shot', 'Meditate',
            'Agility', 'Teleport', 'Screech', 'Haze', 'Focus Energy',
            'Sharpen', 'Conversion', 'Super Fang', 'Substitute',
          ]} />
        </Layer>

        <Layer name="AI_OPPORTUNIST" score="+1">
          <p className="text-gb-dim">
            Penalizes stall/setup moves when HP is low. At 25% or below, stall moves get
            +1. Between 25&ndash;50%, 50% chance of +1. No point boosting when you&apos;re
            about to faint.
          </p>
          <MoveList label="Stall moves penalized" moves={[
            'Swords Dance', 'Tail Whip', 'Leer', 'Growl', 'Disable', 'Mist',
            'Counter', 'Leech Seed', 'Growth', 'String Shot', 'Meditate',
            'Agility', 'Rage', 'Mimic', 'Screech', 'Harden', 'Withdraw',
            'Defense Curl', 'Barrier', 'Light Screen', 'Haze', 'Reflect',
            'Focus Energy', 'Bide', 'Amnesia', 'Transform', 'Splash',
            'Acid Armor', 'Sharpen', 'Conversion', 'Substitute',
          ]} />
        </Layer>

        <Layer name="AI_AGGRESSIVE" score="+1 per non-best">
          <p className="text-gb-dim">
            Calculates actual damage for every damaging move and penalizes (+1) everything
            that isn&apos;t the hardest hitter. Skips fixed-damage, self-destruct, and multi-hit
            moves from the penalty. The closest Gen II gets to a damage calculator &mdash;
            and only some trainers have it.
          </p>
          <MoveList label="Exempt from penalty" moves={[
            'Self-Destruct', 'Explosion', 'Thrash', 'Petal Dance', 'Outrage',
            'Double Slap', 'Comet Punch', 'Fury Attack', 'Pin Missile',
            'Spike Cannon', 'Barrage', 'Double Kick', 'Twineedle',
          ]} />
        </Layer>

        <Layer name="AI_CAUTIOUS" score="+1 (90%)">
          <p className="text-gb-dim">
            After turn 1, penalizes residual/setup moves with 90% chance of +1. If you
            didn&apos;t set up on turn 1, now isn&apos;t the time.
          </p>
          <MoveList label="Residual moves penalized" moves={[
            'Mist', 'Leech Seed', 'Poison Powder', 'Stun Spore', 'Thunder Wave',
            'Focus Energy', 'Bide', 'Poison Gas', 'Transform', 'Conversion',
            'Substitute', 'Spikes',
          ]} />
        </Layer>

        <Layer name="AI_STATUS" score="+10 dismiss">
          <p className="text-gb-dim">
            Type-aware status blocking. Dismisses status moves against immune types:
            Toxic/Poison vs Poison-types, sleep/paralyze when type matchup gives immunity.
          </p>
          <MoveList label="Status moves checked" moves={[
            'Toxic', 'Poison Powder', 'Poison Gas', 'Sing', 'Sleep Powder',
            'Hypnosis', 'Lovely Kiss', 'Spore', 'Thunder Wave', 'Stun Spore', 'Glare',
          ]} />
        </Layer>

        <Layer name="AI_RISKY" score="-5 for KO">
          <p className="text-gb-dim">
            The finisher instinct. If a move can KO the opponent, it gets -5 &mdash; a
            massive bonus. Risky moves (self-destruct, OHKO) are skipped at full HP or
            have 80% skip chance otherwise.
          </p>
          <MoveList label="Risky moves (conditional skip)" moves={[
            'Self-Destruct', 'Explosion', 'Guillotine', 'Horn Drill', 'Fissure',
          ]} />
        </Layer>
      </div>

      <div className="border border-gb-border/50 p-3 space-y-2">
        <div className="text-gb-muted mb-1 font-pokemon" style={{ fontSize: '0.4rem' }}>EXAMPLE &mdash; AI IN ACTION</div>
        <p className="text-gb-dim">
          <span className="text-gb-text">Karen</span> (Elite Four) has AI_BASIC, AI_SETUP,
          AI_SMART, AI_AGGRESSIVE, AI_CAUTIOUS, AI_STATUS, and AI_RISKY. Her Umbreon knows
          Faint Attack, Confuse Ray, Sand-Attack, and Mean Look. On turn 1, AI_SETUP might
          encourage Confuse Ray (-2). But if the opponent is at low HP, AI_RISKY kicks in and
          pushes Faint Attack down by 5 for the KO. AI_AGGRESSIVE confirms it does the most
          damage. Result: she goes for the kill.
        </p>
        <p className="text-gb-dim">
          She also carries <span className="text-gb-text">Full Heal + Full Restore</span>.
          If her ace gets frozen or put to sleep, Full Heal comes out. If HP drops low,
          Full Restore. Just like when you fought her.
        </p>
      </div>

      <div className="border border-gb-border/50 p-3 space-y-2">
        <div className="text-gb-muted mb-1 font-pokemon" style={{ fontSize: '0.4rem' }}>BEYOND MOVES &mdash; SWITCHING &amp; ITEMS</div>
        <p className="text-gb-dim">
          Gen II trainers can also <span className="text-gb-text">switch</span>. The AI
          evaluates type matchups against the opponent&apos;s last move and looks for a team
          member with an immunity or super-effective coverage. Switch frequency depends on
          trainer class: some switch often, some rarely, some never.
        </p>
        <p className="text-gb-dim">
          <span className="text-gb-text">63 trainers</span> carry items &mdash; gym leaders,
          E4, and key story battles. Lance uses a Hyper Potion. Koga and Bruno carry Full
          Heal + Max Potion. X-items are used on turn 1. All parsed from the ROM.
        </p>
      </div>

      <p className="text-gb-dim">
        Every layer, switch check, and item decision was ported from the{' '}
        <a href="https://github.com/pret/pokecrystal" className="text-gb-link hover:text-gb-accent" target="_blank" rel="noreferrer">
          pokecrystal assembly code
        </a>{' '}
        into TypeScript &mdash; including probability rolls and edge cases.
      </p>
    </div>
  );
}

function Gen3AI() {
  return (
    <div className="space-y-3">
      <p className="text-gb-dim">
        Gen III overhauled the AI again. Emerald uses a{' '}
        <span className="text-gb-text">scoring system</span> with{' '}
        <span className="text-gb-text">9 script flags</span> (higher = better). Every move
        starts at score <span className="text-gb-accent">100</span>. Each active script adds
        or subtracts based on battle state. The highest-scoring move is chosen.
      </p>
      <p className="text-gb-dim">
        Key differences from Gen II: <span className="text-gb-text">abilities matter</span>{' '}
        &mdash; Wonder Guard, Levitate, Soundproof, Flash Fire, Volt Absorb, Water Absorb
        all affect move viability. <span className="text-gb-text">Weather is strategic</span>,
        with Sunny Day and Rain Dance combos. Trainers carry up to{' '}
        <span className="text-gb-text">4 items</span> instead of 2. Switching checks for
        type absorption abilities. But the famous{' '}
        <span className="text-gb-text">GetMostSuitableMonToSwitchInto</span> bug picks the
        worst defensive typing instead of the best.
      </p>

      <div className="space-y-3">
        <Layer name="AI_SCRIPT_CHECK_BAD_MOVE" score="-10 / -8">
          <p className="text-gb-dim">
            Penalizes immune, redundant, or wasted moves. Checks abilities: Wonder Guard,
            Levitate, Soundproof, Flash Fire, Volt Absorb, Water Absorb. Penalizes maxed stat
            boosts, duplicate status, duplicate screens, etc. Score: -10 to dismiss, -8 to
            strongly discourage.
          </p>
        </Layer>

        <Layer name="AI_SCRIPT_TRY_TO_FAINT" score="+4 / +2">
          <p className="text-gb-dim">
            If move can KO target: +4 if target is faster, +2 otherwise. If can&apos;t KO but move
            is strongest and AI is low HP, +2.
          </p>
        </Layer>

        <Layer name="AI_SCRIPT_CHECK_VIABILITY" score="-10 to +5">
          <p className="text-gb-dim">
            The &quot;smart&quot; evaluator with ~120 effect-specific handlers. Encourages or
            discourages moves based on detailed battle state. Sleep + Dream Eater combo,
            weather synergies, Baton Pass strategy, Counter/Mirror Coat targeting, stat stage
            awareness, etc.
          </p>
          <MoveList label="Example handlers" moves={[
            'Dream Eater', 'Solar Beam', 'Rain Dance', 'Sunny Day', 'Counter',
            'Mirror Coat', 'Protect', 'Baton Pass',
          ]} />
        </Layer>

        <Layer name="AI_SCRIPT_SETUP_FIRST_TURN" score="+2 (50%)">
          <p className="text-gb-dim">
            On turn 1, 50% chance of +2 to setup/status moves (stat boosts, screens,
            status inflicters).
          </p>
          <MoveList label="Affected" moves={[
            'Swords Dance', 'Dragon Dance', 'Calm Mind', 'Light Screen', 'Reflect',
          ]} />
        </Layer>

        <Layer name="AI_SCRIPT_RISKY" score="+2 (50%)">
          <p className="text-gb-dim">
            50% chance of +2 for risky moves: Explosion, OHKO, Metronome, Destiny Bond,
            Belly Drum, etc.
          </p>
          <MoveList label="Risky moves" moves={[
            'Explosion', 'Self-Destruct', 'Guillotine', 'Horn Drill', 'Fissure',
            'Metronome', 'Destiny Bond', 'Belly Drum',
          ]} />
        </Layer>

        <Layer name="AI_SCRIPT_PREFER_POWER_EXTREMES" score="-1 / +1">
          <p className="text-gb-dim">
            -1 to weak moves (&lt;=40 BP), +1 to strong (&gt;100 BP). Eruption exempt.
          </p>
        </Layer>

        <Layer name="AI_SCRIPT_PREFER_BATON_PASS" score="+2 / -10 / -1">
          <p className="text-gb-dim">
            +2 to setup moves (Swords Dance, Dragon Dance, Calm Mind). -10 to Baton Pass if
            no setup used yet. -1 to non-setup attacks.
          </p>
          <MoveList label="Setup moves" moves={[
            'Swords Dance', 'Dragon Dance', 'Calm Mind', 'Baton Pass',
          ]} />
        </Layer>

        <Layer name="AI_SCRIPT_HP_AWARE" score="varies">
          <p className="text-gb-dim">
            Discourages moves based on HP tiers &mdash; different tables for user high/med/low
            HP and target high/med/low HP.
          </p>
        </Layer>

        <Layer name="AI_SCRIPT_TRY_SUNNY_DAY_START" score="+2 (50%)">
          <p className="text-gb-dim">
            +2 to Sunny Day on turn 1 (50% chance).
          </p>
        </Layer>
      </div>

      <p className="text-gb-dim">
        All scripts were ported from the{' '}
        <a href="https://github.com/pret/pokeemerald" className="text-gb-link hover:text-gb-accent" target="_blank" rel="noreferrer">
          pokeemerald disassembly
        </a>
        .
      </p>
    </div>
  );
}

function Layer({ name, score, children }: { name: string; score: string; children: React.ReactNode }) {
  return (
    <div className="border border-gb-border p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-gb-text font-pokemon" style={{ fontSize: '0.5rem' }}>{name}</span>
        <span className="text-gb-accent font-pokemon shrink-0" style={{ fontSize: '0.4rem' }}>{score}</span>
      </div>
      {children}
    </div>
  );
}

function MoveList({ label, moves }: { label: string; moves: string[] }) {
  if (moves.length <= 6) {
    return (
      <div className="pt-1">
        <div className="text-gb-muted" style={{ fontSize: '0.4rem' }}>{label}:</div>
        <div className="flex flex-wrap gap-1 mt-1">
          {moves.map(m => <MoveTag key={m} name={m} />)}
        </div>
      </div>
    );
  }
  return (
    <details className="pt-1">
      <summary className="text-gb-link cursor-pointer hover:text-gb-accent" style={{ fontSize: '0.4rem' }}>
        {label} ({moves.length} moves) &#9662;
      </summary>
      <div className="flex flex-wrap gap-1 mt-1">
        {moves.map(m => <MoveTag key={m} name={m} />)}
      </div>
    </details>
  );
}

function MoveTag({ name }: { name: string }) {
  return (
    <span className="text-gb-dim border border-gb-border/60 px-1 py-0.5 font-pokemon" style={{ fontSize: '0.35rem' }}>
      {name}
    </span>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="border border-gb-border text-gb-muted px-1.5 py-0.5 font-pokemon" style={{ fontSize: '0.4rem' }}>
      {label}
    </span>
  );
}
