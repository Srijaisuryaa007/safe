import { generateInviteCode } from '../utils';

describe('utils', () => {
  describe('generateInviteCode', () => {
    it('should generate a 6 character string', () => {
      const code = generateInviteCode();
      expect(typeof code).toBe('string');
      expect(code.length).toBe(6);
    });

    it('should be uppercase alphanumeric', () => {
      const code = generateInviteCode();
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    it('should generate different codes on subsequent calls', () => {
      const code1 = generateInviteCode();
      const code2 = generateInviteCode();
      // Very small chance they are equal randomly, but effectively they shouldn't be.
      expect(code1).not.toBe(code2);
    });
  });
});
