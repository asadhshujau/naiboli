import { interpretWhereAmI, resolveIsland } from '../location';
import { islandsSmall } from './fixtures';

const male = { id: 1069, english_name: 'Malé', atoll_code_english: 'K' };

describe('where-am-i handling', () => {
  it('200 + resolved island → ok', () => {
    expect(interpretWhereAmI(200, { resolved: true, island: male })).toEqual({ kind: 'ok', island: male });
  });

  it('422 → far, whatever the body', () => {
    expect(interpretWhereAmI(422, { resolved: false, message: 'Location too far from any island' })).toEqual({ kind: 'far' });
    expect(interpretWhereAmI(422, null)).toEqual({ kind: 'far' });
  });

  it('resolved:false → far even with 200', () => {
    expect(interpretWhereAmI(200, { resolved: false })).toEqual({ kind: 'far' });
  });

  it('server errors, empty bodies and missing islands → fail', () => {
    expect(interpretWhereAmI(500, { resolved: true, island: male })).toEqual({ kind: 'fail' });
    expect(interpretWhereAmI(200, null)).toEqual({ kind: 'fail' });
    expect(interpretWhereAmI(200, 'nope')).toEqual({ kind: 'fail' });
    expect(interpretWhereAmI(200, { resolved: true })).toEqual({ kind: 'fail' });
    expect(interpretWhereAmI(200, { resolved: true, island: { english_name: 'X' } })).toEqual({ kind: 'fail' });
  });

  it('prefers the island from the full list', () => {
    const fromList = resolveIsland(male, islandsSmall);
    expect(fromList).toBe(islandsSmall.find((i) => i.id === 1069));
    expect(fromList.weather_anchor_id).toBe(27);
    expect(resolveIsland(male, null)).toBe(male);
    expect(resolveIsland({ ...male, id: 99999 }, islandsSmall).id).toBe(99999);
  });
});
