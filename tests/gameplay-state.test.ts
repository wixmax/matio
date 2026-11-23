import { describe, expect, it } from 'vitest';
import {
  canStartCompletion,
  canStartGameOver,
  isGameplayActive,
} from '../src/systems/gameplay-state';
import type { GameplayState } from '../src/systems/gameplay-state';

const STATES: GameplayState[] = [
  'loading',
  'playing',
  'completing',
  'results',
  'gameover',
  'error',
];

describe('gameplay state - completion gate', () => {
  it('allows a completion only from the playing state', () => {
    for (const state of STATES) {
      expect(canStartCompletion(state)).toBe(state === 'playing');
    }
  });

  it('keeps input/collection updates active only while playing', () => {
    for (const state of STATES) {
      expect(isGameplayActive(state)).toBe(state === 'playing');
    }
  });

  it('prevents a second completion after the state moves to completing/results', () => {
    expect(canStartCompletion('playing')).toBe(true);
    expect(canStartCompletion('completing')).toBe(false);
    expect(canStartCompletion('results')).toBe(false);
  });

  it('allows Game Over only once, from playing', () => {
    for (const state of STATES) {
      expect(canStartGameOver(state)).toBe(state === 'playing');
    }
  });

  it('prevents victory after a Game Over and prevents damage after victory', () => {
    expect(canStartCompletion('gameover')).toBe(false);
    expect(isGameplayActive('gameover')).toBe(false);
    expect(canStartGameOver('results')).toBe(false);
    expect(isGameplayActive('results')).toBe(false);
  });
});
