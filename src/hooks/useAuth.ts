import { useState, useEffect, createContext, useContext } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, getCurrentUser } from '../lib/supabase';
import type { UserProfile } from '../types/database';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthProvider(): AuthContextType {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { user: currentUser, profile: currentProfile } = await getCurrentUser();
      setUser(currentUser);
      setProfile(currentProfile);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { profile: currentProfile } = await getCurrentUser();
          setUser(session.user);
          setProfile(currentProfile);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { error };
    }

    return {};
  };

  const signUp = async (email: string, password: string, name: string) => {
    console.log('Starting signUp process for email:', email);
    
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
      console.error('Supabase auth signUp error:', error);
      return { error };
    }

    console.log('Auth signUp successful, user data:', data.user?.id);

    // Create user profile
    if (data.user) {
      console.log('Creating user profile in public.users table for ID:', data.user.id);
      
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email,
          name,
          role: 'user'
        });

      if (profileError) {
        console.error('Error creating user profile in public.users:', profileError);
        
        // Check if it's a duplicate key error (user already exists)
        if (profileError.code === '23505') {
          console.log('User profile already exists, continuing...');
        } else {
          // For other errors, we should still return success for auth
          // but log the profile creation failure
          console.error('Profile creation failed but auth user created. User will need manual profile creation.');
        }
      } else {
        console.log('User profile successfully created in public.users for ID:', data.user.id);
      }
    } else {
      console.warn('No user data returned from Supabase auth signUp, profile not created.');
    }

    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      return { error };
    }

    // Refresh profile
    const { profile: updatedProfile } = await getCurrentUser();
    setProfile(updatedProfile);

    return {};
  };

  return {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile
  };
}

export { AuthContext };