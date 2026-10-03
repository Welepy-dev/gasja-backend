import { inicioDoDiaEmLuanda } from './datas';

describe('inicioDoDiaEmLuanda', () => {
  it('23:30 UTC já é o dia seguinte em Luanda', () => {
    expect(
      inicioDoDiaEmLuanda(new Date('2026-10-03T23:30:00Z')).toISOString(),
    ).toBe('2026-10-03T23:00:00.000Z');
  });

  it('a meio do dia', () => {
    expect(
      inicioDoDiaEmLuanda(new Date('2026-10-03T12:00:00Z')).toISOString(),
    ).toBe('2026-10-02T23:00:00.000Z');
  });
});
