import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoundState, Rules } from '../src/index.js';

const START = 10_000;
const players = [
  { id: 'a', name: 'Alex', color: 1 },
  { id: 'b', name: 'Sam', color: 2 },
  { id: 'c', name: 'Jo', color: 3 },
];
const makeRound = () => new RoundState({ startAt: START, players });

test('phases: countdown → playing → ended at max time', () => {
  const round = makeRound();
  assert.equal(round.phase(START - 1), 'countdown');
  assert.equal(round.phase(START), 'playing');
  assert.equal(round.phase(START + Rules.ROUND_MAX_MS), 'ended');
});

test('progress is ignored during countdown', () => {
  const round = makeRound();
  round.updateProgress('a', { current: 0.5, best: 0.5 }, START - 100);
  assert.equal(round.rankings().find((p) => p.id === 'a').best, 0);
});

test('best progress never decreases when current resets', () => {
  const round = makeRound();
  round.updateProgress('a', { current: 0.8, best: 0.8 }, START + 1000);
  round.updateProgress('a', { current: 0, best: 0.4 }, START + 2000);
  const alex = round.rankings().find((p) => p.id === 'a');
  assert.equal(alex.current, 0);
  assert.equal(alex.best, 0.8);
});

test('first finisher starts the finishing window', () => {
  const round = makeRound();
  const event = round.updateProgress('b', { current: 1, best: 1, finished: true }, START + 30_000);
  assert.equal(event.type, 'first-finish');
  assert.equal(event.player.name, 'Sam');
  assert.equal(round.phase(START + 30_001), 'finishing');
  assert.equal(round.endsAt, START + 30_000 + Rules.FINISH_WINDOW_MS);
  assert.equal(round.phase(round.endsAt), 'ended');
});

test('round ends early once everyone has finished', () => {
  const round = makeRound();
  round.updateProgress('a', { finished: true }, START + 1000);
  round.updateProgress('b', { finished: true }, START + 2000);
  const event = round.updateProgress('c', { finished: true }, START + 3000);
  assert.deepEqual(event, { type: 'ended' });
  assert.equal(round.phase(START + 3001), 'ended');
});

test('solo round ends as soon as the only player finishes', () => {
  const round = new RoundState({ startAt: START, players: [players[0]] });
  const event = round.updateProgress('a', { finished: true }, START + 5000);
  assert.deepEqual(event, { type: 'ended' });
});

test('rankings: highest best wins, ties go to whoever got there first', () => {
  const round = makeRound();
  round.updateProgress('a', { current: 0.6, best: 0.6 }, START + 5000);
  round.updateProgress('b', { current: 0.6, best: 0.6 }, START + 4000);
  round.updateProgress('c', { current: 0.9, best: 0.9 }, START + 9000);
  assert.deepEqual(round.rankings().map((p) => p.name), ['Jo', 'Sam', 'Alex']);
});

test('leaving player is removed, and can end the round if the rest finished', () => {
  const round = makeRound();
  round.updateProgress('a', { finished: true }, START + 1000);
  round.updateProgress('b', { finished: true }, START + 2000);
  round.removePlayer('c');
  assert.equal(round.rankings().length, 2);
  assert.equal(round.phase(START + 2001), 'ended');
});
