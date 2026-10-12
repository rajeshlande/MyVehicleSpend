/** Error code for a failed connection, so the offline cache can fall back (FR-PWA-03). */
export const NETWORK_CODE = 'NETWORK';

/** An error whose message is safe to show to the user (SDD §8, API doc §6). */
export class DataError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = 'DataError';
  }
}

interface DbErrorLike {
  code?: string;
  message?: string;
}

/** Maps PostgREST / PostgreSQL errors to plain-language messages. */
export function mapDbError(err: DbErrorLike): DataError {
  const msg = (err.message ?? '').toLowerCase();
  switch (err.code) {
    case '23505':
      return new DataError('A vehicle with this number already exists.', err.code);
    case '23514':
      if (msg.includes('odometer'))
        return new DataError(err.message ?? 'Odometer is too low.', err.code);
      return new DataError('One of the values is outside the allowed range.', err.code);
    case 'P0002':
      return new DataError('That vehicle was not found. It may already be deleted.', err.code);
    case '42501':
      return new DataError("You don't have permission to do that.", err.code);
    default:
      if (msg.includes('fetch') || msg.includes('network'))
        return new DataError(
          "Couldn't reach the server. Check your connection and try again.",
          NETWORK_CODE
        );
      return new DataError('Something went wrong. Please try again.', err.code);
  }
}

export function isNetworkError(e: unknown): boolean {
  return e instanceof DataError && e.code === NETWORK_CODE;
}
