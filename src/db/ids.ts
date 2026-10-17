/** Identifiant unique (UUID v4) généré localement. */
export function newId(): string {
  return crypto.randomUUID();
}
