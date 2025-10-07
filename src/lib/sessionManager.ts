import { supabase } from './supabase';

let isOnline = navigator.onLine;
let sessionCheckInterval: NodeJS.Timeout | null = null;
let lastSuccessfulAuth: number = Date.now();

export interface SessionStatus {
  isValid: boolean;
  needsRefresh: boolean;
  error?: string;
}

export async function validateSession(): Promise<SessionStatus> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Session validation error:', error);
      return { isValid: false, needsRefresh: true, error: error.message };
    }

    if (!session) {
      return { isValid: false, needsRefresh: false };
    }

    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt ? expiresAt - now : 0;

    if (timeUntilExpiry < 300) {
      console.warn('Session expiring soon, needs refresh');
      return { isValid: true, needsRefresh: true };
    }

    lastSuccessfulAuth = Date.now();
    return { isValid: true, needsRefresh: false };
  } catch (error) {
    console.error('Session validation exception:', error);
    return {
      isValid: false,
      needsRefresh: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function refreshSession(): Promise<boolean> {
  try {
    console.log('Attempting to refresh session...');
    const { data: { session }, error } = await supabase.auth.refreshSession();

    if (error) {
      console.error('Session refresh error:', error);
      return false;
    }

    if (session) {
      console.log('Session refreshed successfully');
      lastSuccessfulAuth = Date.now();
      return true;
    }

    return false;
  } catch (error) {
    console.error('Session refresh exception:', error);
    return false;
  }
}

export async function recoverSession(): Promise<boolean> {
  console.log('Attempting session recovery...');

  if (!isOnline) {
    console.log('Offline - skipping session recovery');
    return false;
  }

  const status = await validateSession();

  if (!status.isValid) {
    console.log('Session invalid, attempting refresh...');
    return await refreshSession();
  }

  if (status.needsRefresh) {
    console.log('Session needs refresh...');
    return await refreshSession();
  }

  return true;
}

export function startSessionMonitoring(onSessionLost?: () => void): void {
  if (sessionCheckInterval) {
    return;
  }

  console.log('Starting session monitoring...');

  sessionCheckInterval = setInterval(async () => {
    const timeSinceLastAuth = Date.now() - lastSuccessfulAuth;

    if (timeSinceLastAuth > 30 * 60 * 1000) {
      console.log('No auth activity for 30 minutes, validating session...');
      const status = await validateSession();

      if (!status.isValid) {
        console.warn('Session lost during monitoring');
        if (onSessionLost) {
          onSessionLost();
        }
      } else if (status.needsRefresh) {
        await refreshSession();
      }
    }
  }, 5 * 60 * 1000);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('visibilitychange', handleVisibilityChange);
}

export function stopSessionMonitoring(): void {
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
  }

  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  window.removeEventListener('focus', handleWindowFocus);
  window.removeEventListener('visibilitychange', handleVisibilityChange);

  console.log('Session monitoring stopped');
}

function handleOnline(): void {
  console.log('Network online - recovering session...');
  isOnline = true;
  recoverSession().then(success => {
    if (success) {
      console.log('Session recovered after going online');
      window.dispatchEvent(new CustomEvent('session-recovered'));
    } else {
      console.warn('Failed to recover session after going online');
    }
  });
}

function handleOffline(): void {
  console.log('Network offline detected');
  isOnline = false;
}

function handleWindowFocus(): void {
  const timeSinceLastAuth = Date.now() - lastSuccessfulAuth;

  if (timeSinceLastAuth > 5 * 60 * 1000) {
    console.log('Window focused after 5+ minutes, validating session...');
    validateSession().then(status => {
      if (status.needsRefresh) {
        refreshSession();
      }
    });
  }
}

function handleVisibilityChange(): void {
  if (!document.hidden) {
    const timeSinceLastAuth = Date.now() - lastSuccessfulAuth;

    if (timeSinceLastAuth > 10 * 60 * 1000) {
      console.log('Page visible after 10+ minutes, validating session...');
      validateSession().then(status => {
        if (status.needsRefresh) {
          refreshSession();
        }
      });
    }
  }
}

export function getNetworkStatus(): boolean {
  return isOnline;
}

export function getLastAuthTimestamp(): number {
  return lastSuccessfulAuth;
}
