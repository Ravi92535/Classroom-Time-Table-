import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind class names safely (handles conflicts).
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a random short ID string.
 */
export function generateId() {
  return Math.random().toString(36).substring(2, 11);
}
