import React, { useState, useEffect, createContext } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types/database';
import { getCachedProfile, clearCachedProfile } from '../lib/profileCache';
import { startSessionMonitoring, stopSessionMonitoring, getNetworkStatus } from '../lib/sessionManager';
import { fetchUserProfileWithRetry } from '../lib/profileService';

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

  const fetchProfile = async (
    userId: string,
    useCache: boolean = true
  ): Promise<UserProfile | null> => {
    return fetchUserProfileWithRetry(userId, 3, { useCache });
  };

  useEffect(() => {
    console.log('🚀 AuthProvider: Setting up auth listener');

    const mountedRef = { current: true };
    let timeoutId: NodeJS.Timeout;

    const handleNetworkChange = (e: Event) => {
      const online = (e as CustomEvent).type === 'online';
      console.log(`📡 Network status: ${online ? 'online' : 'offline'}`);
    };

    const handleSessionRecovered = async () => {
      console.log('🔄 Session recovered event received');
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && mountedRef.current) {
        console.log('♻️ Refreshing user data after session recovery');
        try {
          const userProfile = await fetchProfile(session.user.id, true);
          if (mountedRef.current && userProfile) {
            setProfile(userProfile);
          }
        } catch (error) {
          console.warn('⚠️ Profile refresh after recovery failed:', error);
        }
      }
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    window.addEventListener('session-recovered', handleSessionRecovered);

    startSessionMonitoring(() => {
      if (mountedRef.current) {
        console.warn('⚠️ Session lost during monitoring');
        setUser(null);
        setProfile(null);
      }
    });

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
            const userProfile = await fetchProfile(session.user.id, true);
            if (mountedRef.current) {
              setProfile(userProfile);
            }
          } catch (profileError) {
            console.error('💥 AuthProvider: Profile fetch failed:', profileError);
            if (mountedRef.current) {
              const isNetworkError = profileError instanceof Error &&
                (profileError.message.includes('Network') ||
                 profileError.message.includes('timeout') ||
                 profileError.message.includes('fetch') ||
                 profileError.message.includes('aborted'));

              if (isNetworkError) {
                console.log("📡 Network error detected, attempting to use cached profile or keep current state");
                const cached = getCachedProfile(session.user.id);
                if (cached) {
                  console.log("💾 Using cached profile due to network error");
                  setProfile(cached);
                } else if (profile === null) {
                  setProfile(null);
                } else {
                  console.log("⚠️ No cached profile, retaining existing profile due to network error");
                }
              } else {
                setProfile(null);
              }
            }
          }
        } else {
          const isSignOut = _event === 'SIGNED_OUT';
          if (isSignOut) {
            console.log('❌ AuthProvider: User signed out');
            if (mountedRef.current) {
              setUser(null);
              setProfile(null);
            }
          } else if (getNetworkStatus()) {
            console.log('❌ AuthProvider: No session and online, logging out');
            if (mountedRef.current) {
              setUser(null);
              setProfile(null);
            }
          } else {
            console.log('📡 AuthProvider: No session but offline, maintaining state');
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
        console.warn('⏰ AuthProvider: Auth check timeout, clearing loading state and setting initialized to true');
        setLoading(false);
        setInitialized(true); // Ensure initialized is set to true even on timeout
      }
    }, 15000);

    console.log('🎧 AuthProvider: Auth listener setup complete');

    return () => {
      console.log('🧹 AuthProvider: Cleaning up');
      mountedRef.current = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      window.removeEventListener('session-recovered', handleSessionRecovered);
      stopSessionMonitoring();
    };
  }, []);

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
    if (data.user) {
      const userProfileData = {
        id: data.user.id,
        email,
        name,
        role: 'user' as const,
        memory: {},
        preferences: {},
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
      .select()
      .single();

    if (error) {
      console.error('❌ AuthProvider: updateProfile error:', error);
      return { error };
    }

    console.log('✅ AuthProvider: Profile updated successfully');
    if (profile) {
      setProfile({ ...profile, ...updates });
    }

    return {};
  };

  const refreshProfile = async () => {
    console.log('🔄 AuthProvider: refreshProfile called');
    if (!user) {
      console.log('❌ AuthProvider: No user to refresh profile for');
      return;
    }

    try {
      const userProfile = await fetchProfile(user.id, false);
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
