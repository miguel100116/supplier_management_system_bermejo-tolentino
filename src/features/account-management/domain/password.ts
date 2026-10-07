export const ADMIN_PASSWORD_MIN_LENGTH = 16;
export const ADMIN_PASSWORD_MAX_BYTES = 72;

export function validateNewAccountPassword(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || [...value].length < ADMIN_PASSWORD_MIN_LENGTH) {
    throw new Error('Use a password with at least 16 characters.');
  }
  if (new TextEncoder().encode(value).length > ADMIN_PASSWORD_MAX_BYTES) {
    throw new Error('Use a password with no more than 72 UTF-8 bytes.');
  }
  return value;
}

/** Crypto is supplied by the browser; no passwords are persisted by this helper. */
export function generateStrongPassword(random: Pick<Crypto, 'getRandomValues'> = globalThis.crypto): string {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*+-=?'];
  const alphabet = groups.join('');
  const pick = (length: number): number => {
    const limit = 256 - (256 % length);
    let byte: number;
    do { byte = random.getRandomValues(new Uint8Array(1))[0]; } while (byte >= limit);
    return byte % length;
  };
  const characters = groups.map((group) => group[pick(group.length)]);
  while (characters.length < 20) characters.push(alphabet[pick(alphabet.length)]);
  for (let index = characters.length - 1; index > 0; index--) {
    const other = pick(index + 1);
    [characters[index], characters[other]] = [characters[other], characters[index]];
  }
  return characters.join('');
}
