import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/client/api';
import { houseDetailsError } from '../src/client/house-details-error';

describe('house-details server compatibility feedback', () => {
  it('explains the exact old-backend command rejection without claiming the draft was saved', () => {
    const message = houseDetailsError(new ApiError('Unknown action.', 400, { error: 'Unknown action.' }));
    expect(message).toContain('server does not support editing house details yet');
    expect(message).toContain('draft is still here');
    expect(message).toContain('try again after it is updated');
  });
  it.each([401, 403, 409, 429, 500])('preserves real authorization/conflict/server errors (%i)', status => {
    expect(houseDetailsError(new ApiError('Specific failure', status, {}))).toBe('Specific failure');
    expect(houseDetailsError(new ApiError('Unknown action.', status, {}))).toBe('Unknown action.');
  });
  it('preserves validation and network errors', () => {
    expect(houseDetailsError(new ApiError('Enter a name.', 400, {}))).toBe('Enter a name.');
    expect(houseDetailsError(new Error('Failed to fetch'))).toBe('Failed to fetch');
  });
});
