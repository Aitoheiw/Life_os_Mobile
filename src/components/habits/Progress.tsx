import { useMemo, type ReactNode } from 'react';
import { Award, Flame, Lock, Sparkles } from 'lucide-react';
import type { GamificationSummary, HabitProgress } from '../../domain/gamification';
import { XP_PERFECT_DAY } from '../../domain/gamification';
import { Card, ProgressBar, cx } from '../ui';

/** Anneau de progression SVG (le trait se remplit en douceur). */
function Ring({ ratio, size = 88, stroke = 6, className, children }: { ratio: number; size?: number; stroke?: number; className?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cx('relative grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, ratio))}
          className="transition-[stroke-dashoffset] duration-700 ease-smooth"
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

/** Panneau en haut de la page Habitudes : niveau, XP, habitudes du jour, chiffres clés. */
export function ProgressPanel({ summary, celebrate }: { summary: GamificationSummary; celebrate: number }) {
  const { level, today } = summary;
  const perfect = today.due > 0 && today.done === today.due;
  return (
    <Card className="mb-8 overflow-hidden">
      <div className="grid gap-6 p-5 md:grid-cols-[1fr_auto] md:p-6">
        {/* Niveau */}
        <div className="flex items-center gap-5">
          <Ring ratio={level.ratio} className="text-accent">
            <span className="block font-serif text-3xl leading-none text-fg">{level.level}</span>
            <span className="text-[10px] tracking-wider text-muted uppercase">niveau</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl text-fg">{level.title}</p>
            <p className="mt-0.5 text-xs text-muted">
              {level.current} / {level.needed} XP avant le niveau {level.level + 1}
            </p>
            <ProgressBar ratio={level.ratio} className="mt-3 h-2" />
            <p className="mt-2 text-xs text-faint">{summary.totalXp} XP au total</p>
          </div>
        </div>

        {/* Aujourd'hui */}
        <div className="relative flex items-center gap-4 border-t border-line pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
          <Ring ratio={today.due ? today.done / today.due : 0} size={64} stroke={5} className={perfect ? 'text-gold' : 'text-success'}>
            <span className="text-sm font-semibold tabular-nums text-fg">
              {today.done}/{today.due}
            </span>
          </Ring>
          <div>
            <p className="text-sm font-medium text-fg">Aujourd’hui</p>
            {today.due === 0 ? (
              <p className="text-xs text-muted">Rien de prévu, profite.</p>
            ) : perfect ? (
              <p className="animate-rise flex items-center gap-1 text-xs font-medium text-gold">
                <Sparkles size={12} /> Journée parfaite · +{XP_PERFECT_DAY} XP
              </p>
            ) : (
              <p className="text-xs text-muted">
                Encore {today.due - today.done} pour une journée parfaite (+{XP_PERFECT_DAY} XP)
              </p>
            )}
          </div>
          {celebrate > 0 && <Confetti key={celebrate} />}
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-line border-t border-line bg-surface-2/40 text-center">
        <Stat label="Meilleure série" value={`${summary.bestStreak} j`} />
        <Stat label="Journées parfaites" value={summary.perfectDays} />
        <Stat label="Réalisations" value={summary.completions} />
      </dl>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="px-2 py-3">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="font-serif text-lg text-fg tabular-nums">{value}</dd>
    </div>
  );
}

/** Petite explosion de confettis (purement décorative, CSS uniquement). */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const angle = (i / 22) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 40 + Math.random() * 50;
        return {
          dx: `${Math.cos(angle) * dist}px`,
          dy: `${Math.sin(angle) * dist - 20}px`,
          rot: `${Math.random() * 360}deg`,
          color: ['var(--accent)', 'var(--gold)', 'var(--success)'][i % 3],
          delay: `${Math.random() * 80}ms`,
        };
      }),
    [],
  );
  return (
    <span aria-hidden className="pointer-events-none absolute top-1/2 left-8 md:left-14">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute h-1.5 w-1 rounded-[1px] opacity-0"
          style={{ background: p.color, animation: `burst 900ms var(--ease-smooth) ${p.delay} forwards`, ['--dx' as string]: p.dx, ['--dy' as string]: p.dy, ['--rot' as string]: p.rot }}
        />
      ))}
    </span>
  );
}

/** Flamme + nombre de jours de série. Elle s'anime quand la série est vivante et entretenue aujourd'hui. */
export function StreakFlame({ progress, doneToday }: { progress: HabitProgress; doneToday: boolean }) {
  const { currentStreak, bestStreak } = progress;
  const alive = currentStreak > 0;
  return (
    <span
      className={cx('inline-flex items-center gap-1 text-xs font-semibold tabular-nums', alive ? 'text-accent' : 'text-faint')}
      title={`Série en cours : ${currentStreak} jour(s) prévu(s) · record : ${bestStreak}`}
    >
      <Flame size={14} className={cx(alive && doneToday && currentStreak >= 3 && 'animate-flicker')} fill={alive ? 'currentColor' : 'none'} fillOpacity={0.2} />
      {currentStreak}
      <span className="sr-only"> jours de série</span>
    </span>
  );
}

/** Grille des badges : débloqués en doré, les autres grisés avec leur progression. */
export function BadgeGrid({ summary }: { summary: GamificationSummary }) {
  const unlocked = summary.badges.filter((b) => b.unlocked).length;
  return (
    <section className="mt-10">
      <h2 className="mb-3 flex items-baseline justify-between text-xs font-semibold tracking-wide text-muted uppercase">
        Badges
        <span className="font-normal tracking-normal normal-case">
          {unlocked} / {summary.badges.length}
        </span>
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {summary.badges.map((b, i) => (
          <div
            key={b.id}
            style={{ animationDelay: `${i * 40}ms` }}
            className={cx(
              'animate-rise flex items-start gap-3 rounded-2xl border p-3 transition-all duration-300 ease-smooth',
              b.unlocked ? 'border-gold/40 bg-surface shadow-soft hover:-translate-y-0.5' : 'border-line bg-surface/50',
            )}
          >
            <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full', b.unlocked ? 'bg-gold/15 text-gold' : 'bg-surface-2 text-faint')}>
              {b.unlocked ? <Award size={18} /> : <Lock size={14} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cx('text-sm font-medium', b.unlocked ? 'text-fg' : 'text-muted')}>{b.name}</p>
              <p className="text-xs text-faint">{b.description}</p>
              {!b.unlocked && b.value > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar ratio={b.value / b.target} className="h-1" />
                  <span className="text-[10px] text-faint tabular-nums">
                    {b.value}/{b.target}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
