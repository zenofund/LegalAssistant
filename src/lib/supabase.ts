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
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.log('No authenticated user found:', authError);
    return { user: null, profile: null, error: authError };
  }

  console.log('Authenticated user ID:', user.id);

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

  console.log('Profile query result:', { profile, profileError });

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