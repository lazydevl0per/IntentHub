import { cn } from '../../src/lib/utils';

describe('utils', () => {
  it('should merge class names correctly', () => {
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('a', { b: true, c: false })).toBe('a b');
  });
});