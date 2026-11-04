import { factorKey, REC, verdictLabel, verdictOf, VC, vKey } from '../verdict';

describe('verdict mapping', () => {
  it('maps route recommendations', () => {
    expect(REC).toEqual({ ideal: 'go', go: 'go', caution: 'maybe', avoid: 'skip', wait_for_daylight: 'wait' });
    expect(verdictOf({ rec: 'ideal', s: 2 })).toBe('go');
    expect(verdictOf({ rec: 'caution', s: 9 })).toBe('maybe');
    expect(verdictOf({ rec: 'avoid', s: 9 })).toBe('skip');
    expect(verdictOf({ rec: 'wait_for_daylight', s: 9 })).toBe('wait');
  });

  it('falls back to the score for unknown or missing recommendations', () => {
    expect(verdictOf({ rec: '', s: 7 })).toBe('go');
    expect(verdictOf({ rec: 'something_new', s: 6.99 })).toBe('maybe');
    expect(verdictOf({ rec: '', s: 5 })).toBe('maybe');
    expect(verdictOf({ rec: '', s: 4.99 })).toBe('skip');
  });

  it('uses ≥7 go, ≥5 maybe, else skip', () => {
    expect([9.9, 7, 6.9, 5, 4.9, 0].map(vKey)).toEqual(['go', 'go', 'maybe', 'maybe', 'skip', 'skip']);
    expect([7, 5, 4.9].map(factorKey)).toEqual(['go', 'maybe', 'skip']);
  });

  it('labels "Ideal" only for the ideal recommendation', () => {
    expect(verdictLabel('go', { rec: 'ideal' })).toBe('Ideal');
    expect(verdictLabel('go', { rec: 'go' })).toBe('Go');
    expect(verdictLabel('wait', null)).toBe('Wait');
    expect(verdictLabel('maybe', undefined)).toBe('Maybe');
  });

  it('has the README colour table', () => {
    expect(VC.go).toMatchObject({ light: { bg: '#D3F4E9', ink: '#0B6B57', word: '#0E9F7E' }, fill: '#17B890', head: '#D9F5EC', big: 'Go.' });
    expect(VC.maybe.dark).toEqual({ bg: 'rgba(255,200,61,.22)', ink: '#FFD772', word: '#FFD772' });
    expect(VC.skip.line).toBe('Not this time. Another hour will treat you better.');
    expect(VC.wait).toMatchObject({ fill: '#8C97D8', head: '#E2E7F8', big: 'Wait.', line: 'Too dark for now.' });
  });
});
