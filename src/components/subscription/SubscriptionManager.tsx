import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Crown, Zap, Users, CreditCard, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { formatCurrency } from '../../lib/utils';
import type { Plan } from '../../types/database';

interface SubscriptionManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriptionManager({ isOpen, onClose }: SubscriptionManagerProps) {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPlans();
    }
  }, [isOpen]);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan: Plan) => {
    if (!profile) return;

    setUpgrading(true);
    setSelectedPlan(plan);

    try {
      // Initialize Paystack payment
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paystack-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: profile.id,
          plan_id: plan.id,
          amount: plan.price,
          email: profile.email,
          callback_url: `${window.location.origin}/dashboard?payment=success`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to initialize payment');
      }

      const paymentData = await response.json();

      // Redirect to Paystack payment page
      if (paymentData.authorization_url) {
        window.location.href = paymentData.authorization_url;
      }

    } catch (error) {
      console.error('Error upgrading subscription:', error);
      alert('Failed to process payment. Please try again.');
    } finally {
      setUpgrading(false);
      setSelectedPlan(null);
    }
  };

  const currentPlan = profile?.subscription?.plan;

  const planFeatures = {
    free: [
      'Up to 10 document uploads',
      '50 AI chat messages per day',
      'Basic legal research',
      'Standard AI responses',
      'Community support',
      'Export to TXT format'
    ],
    pro: [
      'Up to 100 document uploads',
      '500 AI chat messages per day',
      'Advanced legal research',
      'Enhanced AI responses',
      'Internet search integration',
      'Nigerian legal citation generator',
      'Case summarizer',
      'Export to PDF, DOCX, TXT',
      'Email support'
    ],
    enterprise: [
      'Unlimited document uploads',
      'Unlimited AI chat messages',
      'Premium legal research',
      'Advanced AI responses',
      'Internet search integration',
      'Full citation tools',
      'Advanced case analysis',
      'Precedent tracking',
      'Team collaboration',
      'White-label options',
      'Analytics dashboard',
      'Priority support',
      'Custom integrations'
    ]
  };

  const planIcons = {
    free: Users,
    pro: Zap,
    enterprise: Crown
  };

  const planColors = {
    free: 'border-gray-200 bg-white',
    pro: 'border-blue-200 bg-blue-50 ring-2 ring-blue-500',
    enterprise: 'border-purple-200 bg-purple-50'
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Subscription Plans"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Current Plan Status */}
        {currentPlan && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Current Plan: {currentPlan.name}
                </p>
                <p className="text-xs text-blue-700">
                  {currentPlan.tier === 'free' 
                    ? 'No billing required' 
                    : `${formatCurrency(currentPlan.price)} per ${currentPlan.billing_cycle}`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    <div className="space-y-2">
                      {[...Array(4)].map((_, j) => (
                        <div key={j} className="h-4 bg-gray-200 rounded"></div>
                      ))}
                    </div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            plans.map((plan) => {
              const Icon = planIcons[plan.tier as keyof typeof planIcons];
              const isCurrentPlan = currentPlan?.id === plan.id;
              const features = planFeatures[plan.tier as keyof typeof planFeatures] || [];

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`relative rounded-xl border-2 p-6 ${planColors[plan.tier as keyof typeof planColors]}`}
                >
                  {plan.tier === 'pro' && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-500 text-white px-3 py-1 text-xs font-medium rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <div className="w-12 h-12 mx-auto mb-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <Icon className={`h-6 w-6 ${
                        plan.tier === 'free' ? 'text-gray-600' :
                        plan.tier === 'pro' ? 'text-blue-600' : 'text-purple-600'
                      }`} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <div className="mb-4">
                      {plan.price === 0 ? (
                        <span className="text-3xl font-bold text-gray-900">Free</span>
                      ) : (
                        <div>
                          <span className="text-3xl font-bold text-gray-900">
                            {formatCurrency(plan.price)}
                          </span>
                          <span className="text-gray-600">/{plan.billing_cycle}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    {isCurrentPlan ? (
                      <Button disabled className="w-full">
                        Current Plan
                      </Button>
                    ) : plan.tier === 'free' ? (
                      <Button variant="outline" disabled className="w-full">
                        Downgrade Available
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleUpgrade(plan)}
                        loading={upgrading && selectedPlan?.id === plan.id}
                        className="w-full"
                        variant={plan.tier === 'pro' ? 'primary' : 'outline'}
                      >
                        {currentPlan?.tier === 'free' ? 'Upgrade' : 'Switch Plan'}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Payment Security Notice */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-gray-400 mt-0.5" />
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Secure Payment Processing</p>
              <p>
                All payments are processed securely through Paystack. Your payment information 
                is encrypted and never stored on our servers. You can cancel or modify your 
                subscription at any time.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900">Frequently Asked Questions</h4>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium text-gray-900">Can I change my plan anytime?</p>
              <p className="text-gray-600">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">What happens to my data if I downgrade?</p>
              <p className="text-gray-600">Your data remains safe. However, some features may become unavailable based on your new plan limits.</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">Do you offer refunds?</p>
              <p className="text-gray-600">We offer a 30-day money-back guarantee for all paid plans. Contact support for assistance.</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}