import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Supabase Client Initialization:');
console.log('📍 VITE_SUPABASE_URL:', supabaseUrl);
console.log('🔑 VITE_SUPABASE_ANON_KEY:', supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'undefined');
console.log('🌍 Environment mode:', import.meta.env.MODE);
console.log('📦 All env vars:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Missing URL:', !supabaseUrl);
  console.error('Missing Key:', !supabaseKey);
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

console.log('✅ Supabase client created successfully');
console.log('🔗 Client URL:', supabase.supabaseUrl);
console.log('🔑 Client Key (first 20 chars):', supabase.supabaseKey.substring(0, 20) + '...');

// Helper function to get current user with profile
export async function getCurrentUser() {
  console.log('🔍 getCurrentUser: Starting user fetch...');
  console.log('🔗 Using Supabase URL:', supabase.supabaseUrl);
  
  let user = null;
  let authError = null;
  
  try {
    console.log('🔍 getCurrentUser: Calling supabase.auth.getUser()...');
    const authResult = await supabase.auth.getUser();
    console.log('🔍 getCurrentUser: supabase.auth.getUser() completed');
    user = authResult.data.user;
    authError = authResult.error;
  } catch (error) {
    console.error('❌ getCurrentUser: Exception during supabase.auth.getUser():', error);
    console.error('❌ getCurrentUser: Error type:', typeof error);
    console.error('❌ getCurrentUser: Error message:', error?.message);
    console.error('❌ getCurrentUser: Error stack:', error?.stack);
    return { user: null, profile: null, error };
  }
  
  console.log('🔍 getCurrentUser: Auth result:', { 
    userId: user?.id, 
    userEmail: user?.email,
    authError: authError?.message 
  });
  
  if (authError || !user) {
    console.log('❌ getCurrentUser: No authenticated user found:', authError);
    return { user: null, profile: null, error: authError };
  }

  console.log('✅ getCurrentUser: Authenticated user ID:', user.id);
  console.log('🔍 getCurrentUser: Fetching profile from public.users...');

  let profile = null;
  let profileError = null;
  
  try {
    console.log('🔍 getCurrentUser: Calling profile query...');
    const profileResult = await supabase
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
    console.log('🔍 getCurrentUser: Profile query completed');
    profile = profileResult.data;
    profileError = profileResult.error;
  } catch (error) {
    console.error('❌ getCurrentUser: Exception during profile query:', error);
    console.error('❌ getCurrentUser: Profile error type:', typeof error);
    console.error('❌ getCurrentUser: Profile error message:', error?.message);
    console.error('❌ getCurrentUser: Profile error stack:', error?.stack);
    profileError = error;
  }

  console.log('🔍 getCurrentUser: Profile query result:', { 
    profileFound: !!profile,
    profileId: profile?.id,
    profileName: profile?.name,
    profileError: profileError?.message,
    subscriptionFound: !!profile?.subscriptions?.length
  });

  if (profileError) {
    console.error('❌ getCurrentUser: Profile fetch error:', profileError);
  } else if (!profile) {
    console.warn('⚠️ getCurrentUser: No profile found for user ID:', user.id);
  } else {
    console.log('✅ getCurrentUser: Profile loaded successfully');
  }

  return {
    user,
    profile,
    error: profileError
  };
}

// Helper function to check user permissions
export function hasPermission(userRole: string, requiredRole: string | string[]) {
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const roleHierarchy: Record<string, number> = {
    user: 1,
    admin: 2,
    super_admin: 3
  };

  return roles.some(role => (roleHierarchy[userRole] || 0) >= (roleHierarchy[role] || 0));
}

// Helper function to track feature usage
export async function trackUsage(feature: string, metadata: Record<string, any> = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return;

  await supabase
    .from('usage_tracking')
    .upsert({
      user_id: user.id,
      feature,
      date: new Date().toISOString().split('T')[0],
      count: 1,
      metadata
    }, {
      onConflict: 'user_id,feature,date'
    });
}