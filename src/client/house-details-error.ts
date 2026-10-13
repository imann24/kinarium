import { ApiError } from './api';

export function houseDetailsError(error: unknown): string {
  if (error instanceof ApiError && error.status === 400 && error.message === 'Unknown action.') {
    return 'This server does not support editing house details yet. Your draft is still here. The site needs its server update before you can save; try again after it is updated.';
  }
  return error instanceof Error ? error.message : 'Could not save house details. Try again.';
}
