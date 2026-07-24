export const generateInviteCode = (): string => {
  // Generates a 6 character alphanumeric code
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};
