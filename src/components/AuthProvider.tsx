// src/providers/AuthProvider.tsx (or your equivalent path)

import React, { useState, useEffect, createContext, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, getCurrentUser } from '../lib/supabase'; // Adjust path if needed
import type { UserProfile } from '../types/database'; // Adjust path if needed

// 1. Define the context's data shape
export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: any }>;
}

// 2. Create the context
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. Create the Provider Component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // This useEffect runs only ONCE on component mount, thanks to the empty dependency array [].
  useEffect(() => {
    console.log('🔄 AuthProvider: useEffect triggered - getting initial session');

    // Get initial session and profile
    const getInitialSession = async () => {
      const { user: currentUser, profile: currentProfile } = await getCurrentUser();
      setUser(currentUser);
      setProfile(currentProfile);
      setLoading(false); // IMPORTANT: Set loading to false after the first check is done.
      console.log('✅ AuthProvider: Initial session fetch complete.');
    };

    getInitialSession();

    // Set up a listener for authentication state changes (login, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 AuthProvider: Auth state change detected:', event);
        
        // When the auth state changes, re-fetch the user and profile
        const { user: currentUser, profile: currentProfile } = await getCurrentUser();
        setUser(currentUser);
        setProfile(currentProfile);
        setLoading(false); // Ensure loading is false after handling auth changes
      }
    );

    // The cleanup function runs when the component unmounts
    return () => {
      subscription.unsubscribe();
      console.log('🔄 AuthProvider: Unsubscribed from auth state changes.');
    };
  }, []); // <-- The empty array [] is the key to preventing the loop.

  // --- Authentication and Profile Methods ---

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error || undefined };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });

    if (error) return { error };

    // The onAuthStateChange listener will handle setting the user and profile,
    // but we can create the profile record here immediately after sign-up.
    if (data.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert({ id: data.user.id, email, name, role: 'user' });
      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Don't return this error, as the user was still created.
      }
    }
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // The onAuthStateChange listener will automatically clear the user and profile.
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase.from('users').update(updates).eq('id', user.id);
    if (error) return { error };

    // Refresh profile state after update
    const { profile: updatedProfile } = await getCurrentUser();
    setProfile(updatedProfile);
    return {};
  };

  // The value object that will be available to all consuming components
  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
