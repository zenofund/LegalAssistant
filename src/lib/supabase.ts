import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
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

// Helper function to get current user with profile
export async function getCurrentUser() {
  console.log('🔍 getCurrentUser: Starting user fetch...');
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
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

  const { data: profile, error: profileError } = await supabase
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