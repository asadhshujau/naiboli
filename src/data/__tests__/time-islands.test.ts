import { accIcon, atollLine, cleanIslands, isIsland, labelOf, matches, POP, wxKey } from '../islands';
import { day0Of, dayLabel, dirOf, dur, fmt, fmtHr, fmtLvl, hOfUnix, md24 } from '../time';
import { DAY0, islandsSmall } from './fixtures';

describe('time axis', () => {
  it('finds Maldives midnight regardless of device timezone', () => {
    expect(day0Of(Date.parse('2026-11-04T00:00:00+05:00'))).toBe(DAY0);
    expect(day0Of(Date.parse('2026-11-04T23:59:59+05:00'))).toBe(DAY0);
    expect(day0Of(Date.parse('2026-11-03T23:59:59+05:00'))).toBe(DAY0 - 86400);
    expect(hOfUnix(DAY0 + 5400, DAY0)).toBe(1.5);
  });
  it('formats times', () => {
    expect(fmt(13.25)).toBe('1:15 PM');
    expect(fmt(0)).toBe('12:00 AM');
    expect(fmt(11.9999)).toBe('12:00 PM'); // minute rounding rolls the hour
    expect(fmt(23.9999)).toBe('12:00 AM');
    expect(fmt(-1)).toBe('11:00 PM');
    expect(fmt(26.5)).toBe('2:30 AM');
    expect(fmtHr(19)).toBe('7p');
    expect(fmtHr(0.4)).toBe('12a');
    expect(fmtLvl(0.234)).toBe('+0.23');
    expect(fmtLvl(-0.05)).toBe('−0.05');
    expect(md24(-1)).toBe(23);
    expect(dur(4.5)).toBe('4h 30m');
  });
  it('labels days', () => {
    expect(dayLabel(13, DAY0)).toBe('Wed 4 Nov');
    expect(dayLabel(33, DAY0)).toBe('Thu 5 Nov');
    expect(dirOf(270)).toBe('W');
    expect(dirOf(-10)).toBe('N');
    expect(dirOf(undefined)).toBe('N');
  });
});

describe('islands', () => {
  const male = islandsSmall.find((i) => i.id === 1069)!;
  it('keys weather by anchor', () => {
    expect(wxKey(male)).toBe('27');
    expect(wxKey({ ...male, weather_anchor_id: null })).toBe('i1069');
  });
  it('labels', () => {
    expect(labelOf(male)).toBe('K. Malé');
    expect(atollLine(male)).toBe('Kaafu Atoll');
    expect(atollLine(male, true)).toBe('Kaafu Atoll · Capital');
    const resort = islandsSmall.find((i) => i.id === 90)!;
    expect(atollLine(resort)).toBe('Baa Atoll · Resort');
    expect(atollLine({ ...resort, atoll_code_english: '??', atoll_name_english: 'Odd' }, true)).toBe('Odd Atoll · Resort');
    expect(atollLine({ ...male, id: 5, atoll_code_english: '??', atoll_name_english: null }, true)).toBe('Maldives · Residential');
  });
  it('validates stored islands', () => {
    expect(isIsland(male)).toBe(true);
    expect(isIsland(null)).toBe(false);
    expect(isIsland({ id: 1 })).toBe(false);
    expect(isIsland({ english_name: 'x' })).toBe(false);
    expect(cleanIslands([male, { id: 2, english_name: '' }, null])).toEqual([male]);
    expect(cleanIslands({})).toBeNull();
  });
  it('searches', () => {
    expect(matches('', null)).toEqual(POP);
    expect(matches('', islandsSmall)[0]).toBe(male); // fresh copy from the list
    // prefix matches first (resort .3 before industrial .6, ties by name), substring matches last
    expect(matches('funadhoo', islandsSmall).map((i) => i.english_name + '/' + i.atoll_code_english)).toEqual([
      'Funadhoo/B',
      'Funadhooviligillaa/GA',
      'Funadhoo/GA',
      'Kunfunadhoo/B',
    ]);
    expect(matches('kaafu', islandsSmall).every((i) => i.atoll_code_english === 'K')).toBe(true);
    expect(matches('zzz', islandsSmall)).toEqual([]);
  });
  it('picks access icons', () => {
    expect(accIcon('Public ferry')).toBe('directions_boat_filled');
    expect(accIcon('Seaplane')).toBe('flight_takeoff');
    expect(accIcon('Domestic flight')).toBe('flight');
    expect(accIcon('Speedboat')).toBe('directions_boat');
    expect(accIcon('Dhoni')).toBe('sailing');
    expect(accIcon('Bridge')).toBe('local_taxi');
    expect(accIcon(null)).toBe('route');
  });
});
