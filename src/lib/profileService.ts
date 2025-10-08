import { supabase } from './supabase';
import type { UserProfile } from '../types/database';
import { getCachedProfile, setCachedProfile } from './profileCache';
import { getNetworkStatus } from './sessionManager';

interface FetchOptions {
  useCache?: boolean;
  signal?: AbortSignal;
  skipBackgroundRefresh?: boolean;
}

interface ViewResult {
  id: string;
  email: string;
  name: string;
  role: string;
  current_subscription_id: string | null;
  memory: any;
  preferences: any;
  created_at: string;
  updated_at: string;
  active_subscription_id: string | null;
  plan_id: string | null;
  subscription_status: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  plan_name: string | null;
  plan_tier: string | null;
  plan_price: number | null;
  max_documents: number | null;
  max_chats_per_day: number | null;
  internet_search: boolean | null;
  ai_drafting: boolean | null;
  collaboration: boolean | null;
  ai_model: string | null;
}

function transformViewResultToProfile(data: ViewResult): UserProfile {
  const profile: UserProfile = {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role as 'user' | 'admin' | 'super_admin',
    memory: data.memory || {},
    preferences: data.preferences || {},
    created_at: data.created_at,
    updated_at: data.updated_at,
  };

  if (data.active_subscription_id && data.plan_id) {
    profile.subscription = {
      id: data.active_subscription_id,
      plan_id: data.plan_id,
      status: data.subscription_status || 'active',
      start_date: data.subscription_start_date || '',
      end_date: data.subscription_end_date || null,
      plan: {
        id: data.plan_id,
        name: data.plan_name || 'Free',
        tier: data.plan_tier || 'free',
        price: data.plan_price || 0,
        max_documents: data.max_documents || 0,
        max_chats_per_day: data.max_chats_per_day || 0,
        internet_search: data.internet_search || false,
        ai_drafting: data.ai_drafting || false,
        collaboration: data.collaboration || false,
        ai_model: data.ai_model || 'gpt-4o-mini',
      },
    };
  }

  return profile;
}

export async function fetchUserProfile(
  userId: string,
  options: FetchOptions = {}
): Promise<UserProfile | null> {
  const { useCache = true, signal, skipBackgroundRefresh = false } = options;

  if (useCache) {
    const cached = getCachedProfile(userId);
    if (cached) {
      console.log('💾 ProfileService: Using cached profile');

      if (!skipBackgroundRefresh && getNetworkStatus()) {
        void refreshProfileInBackground(userId);
      }

      return cached;
    }
  }

  if (!getNetworkStatus()) {
    console.log('📡 ProfileService: Offline, cannot fetch profile');
    throw new Error('Network unavailable');
  }

  try {
    console.log('🔍 ProfileService: Fetching profile from optimized view');

    const query = supabase
      .from('user_profiles_with_subscription')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const { data, error } = signal
      ? await Promise.race([
          query,
          new Promise<never>((_, reject) => {
            signal.addEventListener('abort', () => reject(new Error('Request aborted')));
          })
        ])
      : await query;

    if (error) {
      console.error('❌ ProfileService: Error fetching profile:', error);
      throw error;
    }

    if (!data) {
      console.warn('⚠️ ProfileService: No profile found for user:', userId);
      return null;
    }

    const profile = transformViewResultToProfile(data as ViewResult);

    console.log('✅ ProfileService: Profile loaded:', profile.name || profile.email);

    setCachedProfile(userId, profile);
    return profile;
  } catch (error) {
    console.error('💥 ProfileService: Profile fetch failed:', error);

    const cached = getCachedProfile(userId);
    if (cached) {
      console.log('💾 ProfileService: Returning cached profile after error');
      return cached;
    }

    throw error;
  }
}

async function refreshProfileInBackground(userId: string): Promise<void> {
  try {
    console.log('🔄 ProfileService: Starting background profile refresh');
    const profile = await fetchUserProfile(userId, {
      useCache: false,
      skipBackgroundRefresh: true
    });

    if (profile) {
      console.log('✅ ProfileService: Background refresh complete');
    }
  } catch (error) {
    console.warn('⚠️ ProfileService: Background refresh failed:', error);
  }
}

export async function fetchUserProfileWithRetry(
  userId: string,
  maxAttempts: number = 3,
  options: FetchOptions = {}
): Promise<UserProfile | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`🔍 ProfileService: Fetch attempt ${attempt + 1}/${maxAttempts}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const profile = await fetchUserProfile(userId, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return profile;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      lastError = error;
      console.error(`💥 ProfileService: Attempt ${attempt + 1} failed:`, error);

      if (!getNetworkStatus()) {
        console.log('📡 ProfileService: Network offline, stopping retries');
        break;
      }

      if (attempt < maxAttempts - 1) {
        const baseDelay = 1000;
        const jitter = Math.random() * 500;
        const delay = Math.min(baseDelay * Math.pow(2, attempt) + jitter, 5000);

        console.log(`⏳ ProfileService: Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const cached = getCachedProfile(userId);
  if (cached) {
    console.log('💾 ProfileService: All retries failed, using cached profile');
    return cached;
  }

  throw lastError || new Error('Failed to fetch profile after retries');
}
