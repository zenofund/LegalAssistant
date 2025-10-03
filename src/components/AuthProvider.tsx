import React, { useState, useEffect, createContext } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase'; // Assuming getCurrentUser is no longer needed here
import { useToast } from './ui/Toast';
import type { UserProfile } from '../types/database';

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
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    console.log('🚀 AuthProvider: Setting up auth listener');

    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        console.log('🔄 AuthProvider: Auth state change:', _event);
        console.log('🎫 AuthProvider: Session:', session ? 'exists' : 'null');

        clearTimeout(timeoutId);

        if (session?.user) {
          // Skip profile fetch if user and profile are already loaded for this session
          // unless it's a token refresh which might need updated data
          if (user && profile && user.id === session.user.id && _event !== 'TOKEN_REFRESHED') {
            console.log('🔄 AuthProvider: Skipping redundant profile fetch for existing session');
            if (mounted) {
              setLoading(false);
              if (!initialized) {
                setInitialized(true);
              }
            }
            return;
          }

          console.log('✅ AuthProvider: User session found, fetching profile...');
          
          // Create timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000);
          });

          try {
            // Race between profile fetch and timeout
            const profileQuery = supabase
              .from('users')
              .select(`
                *,
                subscriptions (
                  *,
                  plan:plans (*)
                )
              `)
              .eq('id', session.user.id)
              .maybeSingle();

            const { data: userProfile, error } = await Promise.race([
              profileQuery,
              timeoutPromise
            ]) as any;

            if (!mounted) return;

            if (error) {
              console.error('❌ AuthProvider: Error fetching profile:', error);
              setUser(session.user);
              setProfile(null);
            } else if (userProfile) {
              console.log('✅ AuthProvider: Profile loaded:', userProfile.name);
              setUser(session.user);
              setProfile(userProfile);
            } else {
              console.warn('⚠️ AuthProvider: No profile found for user:', session.user.id);
              setUser(session.user);
              setProfile(null);
            }
          } catch (profileError) {
            console.error('💥 AuthProvider: Exception during profile fetch:', profileError);
            if (mounted) {
              setUser(session.user);
              setProfile(null);
            }
          }
        } else {
          console.log('❌ AuthProvider: No user session');
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
        }

        if (mounted) {
          console.log('✅ AuthProvider: Auth check complete');
          setLoading(false);
          if (!initialized) {
            setInitialized(true);
          }
        }
      }
    );

    timeoutId = setTimeout(() => {
      if (!initialized && mounted) {
        console.warn('⏰ AuthProvider: Auth check timeout, clearing loading state');
        setLoading(false);
        setInitialized(true);
      }
    }, 10000);

    console.log('🎧 AuthProvider: Auth listener setup complete');

    return () => {
      console.log('🧹 AuthProvider: Cleaning up');
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
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
    
    try {
      await supabase.auth.signOut();
      showSuccess('Signed Out', 'You have been signed out successfully.');
    } catch (error) {
      console.error('❌ AuthProvider: signOut error:', error);
      showError('Sign Out Failed', 'There was an error signing you out. Please try again.');
    }
    
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

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Profile refresh timeout')), 5000);
    });

    try {
      console.log('🔍 AuthProvider: Fetching fresh profile data for user:', user.id);
      
      const profileQuery = supabase
        .from('users')
        .select(`
          *,
          subscriptions (
            *,
            plan:plans (*)
          )
        `)
        .eq('id', user.id)
        .maybeSingle();

      const { data: userProfile, error } = await Promise.race([
        profileQuery,
        timeoutPromise
      ]) as any;

      if (error) {
        console.error('❌ AuthProvider: Error refreshing profile:', error);
        return;
      }

      if (userProfile) {
        console.log('✅ AuthProvider: Profile refreshed successfully');
        setProfile(userProfile);
      }
    } catch (error) {
      console.error('💥 AuthProvider: Exception during profile refresh:', error);
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
