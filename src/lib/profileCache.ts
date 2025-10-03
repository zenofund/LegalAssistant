import type { UserProfile } from '../types/database';

const CACHE_KEY = 'user_profile_cache';
const CACHE_DURATION = 5 * 60 * 1000;

interface CachedProfile {
  profile: UserProfile;
  timestamp: number;
}

export function getCachedProfile(userId: string): UserProfile | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${userId}`);
    if (!cached) return null;

    const { profile, timestamp }: CachedProfile = JSON.parse(cached);
    const now = Date.now();

    if (now - timestamp > CACHE_DURATION) {
      localStorage.removeItem(`${CACHE_KEY}_${userId}`);
      return null;
    }

    console.log('📦 Using cached profile data');
    return profile;
  } catch (error) {
    console.error('Error reading cached profile:', error);
    return null;
  }
}

export function setCachedProfile(userId: string, profile: UserProfile): void {
  try {
    const cached: CachedProfile = {
      profile,
      timestamp: Date.now()
    };
    localStorage.setItem(`${CACHE_KEY}_${userId}`, JSON.stringify(cached));
    console.log('💾 Profile cached successfully');
  } catch (error) {
    console.error('Error caching profile:', error);
  }
}

export function clearCachedProfile(userId: string): void {
  try {
    localStorage.removeItem(`${CACHE_KEY}_${userId}`);
    console.log('🗑️ Profile cache cleared');
  } catch (error) {
    console.error('Error clearing cached profile:', error);
  }
}

export function clearAllProfileCaches(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_KEY)) {
        localStorage.removeItem(key);
      }
    });
    console.log('🗑️ All profile caches cleared');
  } catch (error) {
    console.error('Error clearing all profile caches:', error);
  }
}
