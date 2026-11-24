import { describe, it, expect, beforeEach } from 'vitest';
import { PairingDesk } from '../PairingDesk';

describe('PairingDesk', () => {
  let clock: number;
  let issued: number;
  let desk: PairingDesk;

  beforeEach(() => {
    clock = Date.parse('2026-11-14T10:00:00.000Z');
    issued = 0;
    desk = new PairingDesk(
      () => clock,
      () => `codigo-${(issued += 1)}`,
    );
  });

  it('accepts nothing before a code is opened', () => {
    expect(desk.isOpen()).toBe(false);
    expect(desk.redeem('codigo-1')).toBe(false);
  });

  it('opens a code that lasts five minutes', () => {
    expect(desk.open()).toEqual({ code: 'codigo-1', expiresAt: '2026-11-14T10:05:00.000Z' });
    expect(desk.isOpen()).toBe(true);
  });

  it('accepts the open code once', () => {
    desk.open();

    expect(desk.redeem('codigo-1')).toBe(true);
    expect(desk.redeem('codigo-1')).toBe(false);
    expect(desk.isOpen()).toBe(false);
  });

  it('refuses the code after it expires', () => {
    desk.open();
    clock += 5 * 60 * 1000;

    expect(desk.redeem('codigo-1')).toBe(false);
  });

  it('keeps only the newest code open', () => {
    desk.open();
    desk.open();

    expect(desk.redeem('codigo-1')).toBe(false);
    expect(desk.redeem('codigo-2')).toBe(true);
  });

  it('cancels the code after five wrong guesses, so the right one no longer works', () => {
    desk.open();
    for (let guess = 0; guess < 5; guess += 1) desk.redeem(`errado-${guess}`);

    expect(desk.redeem('codigo-1')).toBe(false);
  });

  it('still accepts the right code after four wrong guesses, and anything that is not text counts as wrong', () => {
    desk.open();
    [undefined, 12, null, {}].forEach((guess) => expect(desk.redeem(guess)).toBe(false));

    expect(desk.redeem('codigo-1')).toBe(true);
  });

  it('closes the code when the person leaves the pairing screen', () => {
    desk.open();
    desk.cancel();

    expect(desk.redeem('codigo-1')).toBe(false);
  });
});
