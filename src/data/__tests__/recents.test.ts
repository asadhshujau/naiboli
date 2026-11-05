import { addRecent, defaultIslands, pickerIslands, POP, RECENTS_MAX } from '../islands';
import type { ApiIsland } from '../types';

const isle = (id: number): ApiIsland => ({ id, english_name: 'Isle ' + id, dhivehi_name: '', atoll_code_english: 'K', category: 'Residential Island' });
const ids = (L: ApiIsland[]) => L.map((i) => i.id);
const [male, hulhumale, maafushi, thulusdhoo, ukulhas, fuvahmulah] = POP;

describe('recent islands', () => {
  it('addRecent moves the island to the front, no duplicates, capped', () => {
    let r: ApiIsland[] = [];
    for (const id of [1, 2, 3, 2, 4, 5, 6, 7, 8]) r = addRecent(r, isle(id));
    expect(ids(r)).toEqual([8, 7, 6, 5, 4, 2]);
    expect(r).toHaveLength(RECENTS_MAX);
  });

  it('no recents: current first, then the popular islands', () => {
    expect(ids(defaultIslands(male, [], null))).toEqual(ids(POP));
    expect(ids(defaultIslands(isle(7), [], null))).toEqual([7, ...ids(POP).slice(0, 5)]);
  });

  it('current island, then recents most recent first (current left out), padded with popular', () => {
    const recents = [isle(9), isle(7), ukulhas, isle(8)];
    expect(ids(defaultIslands(isle(7), recents, null))).toEqual([7, 9, 25, 8, male.id, hulhumale.id]);
  });

  it('five recents fill the list: 6 rows, no padding', () => {
    const recents = [isle(1), isle(2), isle(3), isle(4), isle(5), isle(6)];
    expect(ids(defaultIslands(isle(1), recents, null))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ids(defaultIslands(isle(9), recents, null))).toEqual([9, 1, 2, 3, 4, 5]);
  });

  it('padding skips popular islands already listed', () => {
    expect(ids(defaultIslands(maafushi, [fuvahmulah, male], null))).toEqual([1060, 1002, 1069, 1068, 1017, 25]);
    expect(ids(defaultIslands(thulusdhoo, [], null))).toEqual([1017, 1069, 1068, 1060, 25, 1002]);
  });

  it('uses fresh copies from the island list when loaded', () => {
    const L = [{ ...isle(9), english_name: 'Fresh 9' }, { ...male, latitude_decimal: '4.17' }];
    const out = defaultIslands(isle(9), [male], L);
    expect(out[0].english_name).toBe('Fresh 9');
    expect(out[1].latitude_decimal).toBe('4.17');
  });

  it('a query searches as before', () => {
    expect(ids(pickerIslands('ukul', [ukulhas, male], isle(9), [male]))).toEqual([25]);
    expect(ids(pickerIslands('', null, isle(9), [male]))[0]).toBe(9);
  });
});
