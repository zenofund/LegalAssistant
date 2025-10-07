import type { UserProfile } from '../types/database';

export function getUserTier(profile: UserProfile | null): 'free' | 'pro' | 'enterprise' {
  if (!profile) return 'free';

  if (Array.isArray(profile.subscriptions) && profile.subscriptions.length > 0) {
    const activeSubscription = profile.subscriptions.find(
      (sub: any) => sub.status === 'active'
    );
    if (activeSubscription?.plans?.tier) {
      return activeSubscription.plans.tier;
    }
  }

  if ((profile as any).subscription) {
    const sub = (profile as any).subscription;
    if (sub.plan?.tier) {
      return sub.plan.tier;
    }
    if (sub.plans?.tier) {
      return sub.plans.tier;
    }
  }

  if ((profile as any).plan_tier) {
    return (profile as any).plan_tier;
  }

  if (profile.is_premium) {
    return 'pro';
  }

  return 'free';
}

export function getUserPlan(profile: UserProfile | null) {
  if (!profile) return null;

  if (Array.isArray(profile.subscriptions) && profile.subscriptions.length > 0) {
    const activeSubscription = profile.subscriptions.find(
      (sub: any) => sub.status === 'active'
    );
    if (activeSubscription?.plans) {
      return activeSubscription.plans;
    }
  }

  if ((profile as any).subscription?.plan) {
    return (profile as any).subscription.plan;
  }

  if ((profile as any).subscription?.plans) {
    return (profile as any).subscription.plans;
  }

  return null;
}
