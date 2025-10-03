import React, { useState, useEffect, createContext } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
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
  const { showSuccess, showError } = useToast();

  // --- [START] MODIFIED SECTION ---
  useEffect(() => {
    console.log('🚀 AuthProvider: Setting up auth listener');
    setLoading(true); // Start in a loading state

    // This flag prevents race conditions where multiple auth events
    // trigger simultaneous profile fetches.
    let isFetching = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 AuthProvider: Auth state change:', event);

        // If a session exists and we are not already fetching...
        if (session?.user && !isFetching) {
          isFetching = true; // Set lock
          console.log('✅ AuthProvider: Session found, fetching profile...');

          const { data: userProfile, error } = await supabase
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

          if (error) {
            console.error('❌ AuthProvider: Error fetching profile:', error.message);
            // Still set the user from the session, but profile is null
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

          isFetching = false; // Release lock
        }
        // If there is no session, the user is signed out.
        else if (!session) {
          console.log('❌ AuthProvider: No user session, clearing state.');
          setUser(null);
          setProfile(null);
        }

        console.log('✅ AuthProvider: Auth check complete');
        setLoading(false); // Always finish by clearing the loading state
      }
    );

    console.log('🎧 AuthProvider: Auth listener setup complete');

    return () => {
      console.log('🧹 AuthProvider: Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []); // The empty dependency array ensures this runs only once on mount.
  // --- [END] MODIFIED SECTION ---

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

    try {
      console.log('🔍 AuthProvider: Fetching fresh profile data for user:', user.id);
      
      const { data: userProfile, error } = await supabase
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
