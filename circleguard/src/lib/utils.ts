export const generateInviteCode = (): string => {
  // Generates a 6 character alphanumeric code
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const isValidUuid = (id: any): boolean => {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
};
