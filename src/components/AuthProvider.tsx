import React, { useState, useEffect, createContext } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types/database';
import { getCachedProfile, setCachedProfile, clearCachedProfile } from '../lib/profileCache';

// Define the AuthContextType interface
export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: any }>;
  refreshProfile: () => Promise<void>;
}

// Create and export the AuthContext
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const fetchProfileWithRetry = async (
    userId: string,
    attempt: number = 0,
    useCache: boolean = true,
    mountedRef?: { current: boolean }
  ): Promise<UserProfile | null> => {
    if (useCache && attempt === 0) {
      const cached = getCachedProfile(userId);
      if (cached) {
        console.log('💾 AuthProvider: Using cached profile');

        (async () => {
          try {
            const fresh = await fetchProfileWithRetry(userId, 0, false, mountedRef);
            if (fresh && (!mountedRef || mountedRef.current)) {
              setCachedProfile(userId, fresh);
              setProfile(fresh);
              console.log('🔄 AuthProvider: Background profile refresh complete');
            }
          } catch (error) {
            console.warn('⚠️ AuthProvider: Background refresh failed, using cached data');
          }
        })();

        return cached;
      }
    }

    const maxAttempts = 3;
    const timeout = 10000;

    try {
      console.log(`🔍 AuthProvider: Fetching profile (attempt ${attempt + 1}/${maxAttempts})...`);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), timeout);
      });

      const profileQuery = supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const { data: userProfile, error } = await Promise.race([
        profileQuery,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('❌ AuthProvider: Error fetching profile:', error);
        throw error;
      }

      if (!userProfile) {
        console.warn('⚠️ AuthProvider: No profile found for user:', userId);
        return null;
      }

      console.log('✅ AuthProvider: Base profile loaded:', userProfile.name);

      try {
        const subQuery = supabase
          .from('subscriptions')
          .select(`
            *,
            plan:plans (*)
          `)
          .eq('user_id', userId)
          .maybeSingle();

        const subTimeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Subscription fetch timeout')), 5000);
        });

        const { data: subscription } = await Promise.race([subQuery, subTimeout]) as any;

        if (subscription) {
          console.log('✅ AuthProvider: Subscription data loaded');
          const fullProfile = { ...userProfile, subscription };
          setCachedProfile(userId, fullProfile);
          return fullProfile;
        }
      } catch (subError) {
        console.warn('⚠️ AuthProvider: Could not load subscription, continuing with basic profile');
      }

      setCachedProfile(userId, userProfile);
      return userProfile;
    } catch (error) {
      console.error(`💥 AuthProvider: Profile fetch attempt ${attempt + 1} failed:`, error);

      if (attempt < maxAttempts - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`⏳ AuthProvider: Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchProfileWithRetry(userId, attempt + 1, false, mountedRef);
      }

      throw error;
    }
  };

  useEffect(() => {
    console.log('🚀 AuthProvider: Setting up auth listener');

    const mountedRef = { current: true };
    let timeoutId: NodeJS.Timeout;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mountedRef.current) return;

        console.log('🔄 AuthProvider: Auth state change:', _event);
        console.log('🎫 AuthProvider: Session:', session ? 'exists' : 'null');

        clearTimeout(timeoutId);

        if (session?.user) {
          console.log('✅ AuthProvider: User session found, fetching profile...');
          setUser(session.user);

          try {
            const userProfile = await fetchProfileWithRetry(session.user.id, 0, true, mountedRef);
            if (mountedRef.current) {
              setProfile(userProfile);
            }
          } catch (profileError) {
            console.error('💥 AuthProvider: All profile fetch attempts failed:', profileError);
            if (mountedRef.current) {
              setProfile(null);
            }
          }
        } else {
          console.log('❌ AuthProvider: No user session');
          if (mountedRef.current) {
            setUser(null);
            setProfile(null);
          }
        }

        if (mountedRef.current) {
          console.log('✅ AuthProvider: Auth check complete');
          setLoading(false);
          if (!initialized) {
            setInitialized(true);
          }
        }
      }
    );

    timeoutId = setTimeout(() => {
      if (!initialized && mountedRef.current) {
        console.warn('⏰ AuthProvider: Auth check timeout, clearing loading state');
        setLoading(false);
        setInitialized(true);
      }
    }, 15000);

    console.log('🎧 AuthProvider: Auth listener setup complete');

    return () => {
      console.log('🧹 AuthProvider: Cleaning up');
      mountedRef.current = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [initialized]);

  const signIn = async (email: string, password: string) => {
    console.log('🔐 AuthProvider: signIn called for email:', email);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('❌ AuthProvider: signIn error:', error);
      return { error };
    }

    console.log('✅ AuthProvider: signIn successful');
    return {};
  };

  const signUp = async (email: string, password: string, name: string) => {
    console.log('📝 AuthProvider: signUp called for email:', email, 'name:', name);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name
        }
      }
    });

    if (error) {
      console.error('❌ AuthProvider: signUp auth error:', error);
      return { error };
    }

    console.log('✅ AuthProvider: signUp auth successful, creating profile...');
    // Create user profile
    if (data.user) {
      const userProfileData = {
        id: data.user.id,
        email,
        name,
        role: 'user' as const
      };
      
      console.log('🔍 SignUp: Attempting to insert user profile with data:', userProfileData);
      
      const { error: profileError } = await supabase
        .from('users')
        .insert(userProfileData);

      if (profileError) {
        console.error('❌ SignUp: Profile creation error:', profileError);
        console.error('❌ SignUp: Profile error details:', {
          code: profileError.code,
          message: profileError.message,
          details: profileError.details,
          hint: profileError.hint
        });
        return { error: profileError };
      } else {
        console.log('✅ SignUp: User profile created successfully');
      }
    }

    return {};
  };

  const signOut = async () => {
    console.log('🚪 AuthProvider: signOut called');
    if (user) {
      clearCachedProfile(user.id);
    }
    await supabase.auth.signOut();
    console.log('🧹 AuthProvider: Clearing user and profile states');
    setUser(null);
    setProfile(null);
    console.log('✅ AuthProvider: signOut complete');
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    console.log('📝 AuthProvider: updateProfile called with updates:', updates);
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select() // It's good practice to select the updated data
      .single();

    if (error) {
      console.error('❌ AuthProvider: updateProfile error:', error);
      return { error };
    }

    console.log('✅ AuthProvider: Profile updated successfully');
    // After a successful update, refresh the profile state with the new data
    // This avoids another network request.
    setProfile((prevProfile) => ({ ...prevProfile, ...updates }));

    return {};
  };

  const refreshProfile = async () => {
    console.log('🔄 AuthProvider: refreshProfile called');
    if (!user) {
      console.log('❌ AuthProvider: No user to refresh profile for');
      return;
    }

    try {
      const userProfile = await fetchProfileWithRetry(user.id);
      if (userProfile) {
        console.log('✅ AuthProvider: Profile refreshed successfully');
        setProfile(userProfile);
      }
    } catch (error) {
      console.error('💥 AuthProvider: Failed to refresh profile:', error);
    }
  };

  const authContextValue: AuthContextType = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}
