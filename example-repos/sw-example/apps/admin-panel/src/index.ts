import { AuthProvider, LoginForm } from '@repo/auth-ui';
import { Database } from '@repo/database';

export function initAdminPanel() {
  console.log('Initializing admin panel');
  // Uses auth-ui components
  return { AuthProvider, LoginForm };
}