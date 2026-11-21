/**
 * GitHub cron runs in UTC. The workflow lists the slots for winter time (UTC+1) and summer time (UTC+2), and this
 * gate lets only the set through that matches the current offset in Europe/Berlin. Writes run=true|false to
 * $GITHUB_OUTPUT. Usage: tsx scripts/schedule-gate.ts <event-name> <cron-expression>
 */
import { appendFileSync } from 'node:fs';

/** Mo–Fr 6:30–19:00 local time every 45 minutes. Keep in sync with .github/workflows/deploy.yml. */
export const WINTER_CRONS = ['30 5,8,11,14,17 * * 1-5', '15 6,9,12,15 * * 1-5', '0,45 7,10,13,16 * * 1-5'];
export const SUMMER_CRONS = ['30 4,7,10,13,16 * * 1-5', '15 5,8,11,14 * * 1-5', '0,45 6,9,12,15 * * 1-5'];

/** Offset of Europe/Berlin from UTC in minutes at `now` (60 or 120). */
export function berlinOffsetMinutes(now: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = name?.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!m) return 60;
  const h = Number(m[1]);
  return h * 60 + Math.sign(h) * Number(m[2] ?? 0);
}

export function shouldRun(event: string, cron: string, now: Date): boolean {
  if (event !== 'schedule') return true;
  const crons = berlinOffsetMinutes(now) === 120 ? SUMMER_CRONS : WINTER_CRONS;
  return crons.includes(cron.trim());
}

/** Local times the schedule produces for a given offset, for tests and docs. */
export function localSlots(crons: string[], offsetMinutes: number): string[] {
  const slots: string[] = [];
  for (const c of crons) {
    const [mins, hours] = c.split(' ');
    for (const h of hours.split(',').map(Number)) {
      for (const m of mins.split(',').map(Number)) {
        const t = h * 60 + m + offsetMinutes;
        slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
      }
    }
  }
  return slots.sort();
}

if (process.argv[1]?.endsWith('schedule-gate.ts')) {
  const [event = '', cron = ''] = process.argv.slice(2);
  const run = shouldRun(event, cron, new Date());
  console.log(`event=${event} cron="${cron}" run=${run}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
}
