import React, { useState, useEffect, createContext } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase'; // Assuming getCurrentUser is no longer needed here
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

  // --- UPDATED useEffect HOOK ---
  useEffect(() => {
    console.log('🚀 AuthProvider: useEffect triggered - Setting up auth listener');
    setLoading(true);
    console.log('⏳ AuthProvider: Loading state set to true');

    // onAuthStateChange handles the initial session check automatically.
    // It fires once on load with the current session or null.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('🔄 AuthProvider: onAuthStateChange callback triggered');
        console.log('📋 AuthProvider: Event:', _event);
        console.log('🎫 AuthProvider: Session:', session ? 'exists' : 'null');
        console.log('👤 AuthProvider: User ID:', session?.user?.id || 'none');
        console.log('📧 AuthProvider: User Email:', session?.user?.email || 'none');
        
        if (session?.user) {
          console.log('✅ AuthProvider: User session found, fetching profile...');
          // When a session is found, fetch the associated profile
          try {
            console.log('🔍 AuthProvider: Querying users table for ID:', session.user.id);
            const { data: userProfile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

            console.log('📊 AuthProvider: Profile query result:', {
              profileFound: !!userProfile,
              profileId: userProfile?.id,
              profileName: userProfile?.name,
              profileRole: userProfile?.role,
              error: error?.message
            });

            if (error) {
              console.error('❌ AuthProvider: Error fetching profile:', error);
              console.error('❌ AuthProvider: Error details:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
              });
              setProfile(null);
            } else if (userProfile) {
              console.log('✅ AuthProvider: Profile loaded successfully:', userProfile.name);
              setProfile(userProfile);
            } else {
              console.warn('⚠️ AuthProvider: No profile found for user ID:', session.user.id);
              setProfile(null);
            }
          } catch (profileError) {
            console.error('💥 AuthProvider: Exception during profile fetch:', profileError);
            setProfile(null);
          }
          
          console.log('👤 AuthProvider: Setting user state');
          setUser(session.user);
        } else {
          console.log('❌ AuthProvider: No user session found, clearing states');
          // If no session, clear user and profile
          setUser(null);
          setProfile(null);
        }
        
        console.log('🏁 AuthProvider: Setting loading to false');
        // The loading state should only be set to false once,
        // after the initial auth check is complete.
        setLoading(false);
        console.log('✅ AuthProvider: Auth state update complete');
      }
    );

    console.log('🎧 AuthProvider: Auth listener setup complete');
    
    // Unsubscribe from the listener when the component unmounts
    return () => {
      console.log('🧹 AuthProvider: Cleaning up auth listener');
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

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
        .single();

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
