import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Zap, Crown, ArrowRight, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { formatCurrency } from '../../lib/utils';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  currentUsage: number;
  maxLimit: number;
  planTier: string;
}

export function UpgradeModal({
  isOpen,
  onClose,
  onUpgrade,
  currentUsage,
  maxLimit,
  planTier
}: UpgradeModalProps) {
  const plans = [
    {
      tier: 'pro',
      name: 'Pro',
      price: 15000,
      chatsPerDay: 500,
      icon: Zap,
      color: 'blue',
      features: [
        '500 AI chats per day',
        'Internet search integration',
        'Legal Citation Generator',
        'Case Summarizer',
        'Advanced case analysis',
        'Export to PDF, DOCX, TXT'
      ]
    },
    {
      tier: 'enterprise',
      name: 'Enterprise',
      price: 50000,
      chatsPerDay: -1,
      icon: Crown,
      color: 'purple',
      features: [
        'Unlimited AI chats',
        'Priority support',
        'Team collaboration',
        'Custom integrations',
        'Analytics dashboard',
        'White-label options'
      ]
    }
  ];

  const availablePlans = plans.filter(p => {
    if (planTier === 'free') return true;
    if (planTier === 'pro') return p.tier === 'enterprise';
    return false;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="3xl">
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Daily Chat Limit Reached
          </h2>
          <p className="text-gray-600 max-w-md mx-auto">
            You've used <span className="font-semibold">{currentUsage} of {maxLimit}</span> chats today.
            Upgrade to continue your legal research without interruption.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {availablePlans.map((plan) => {
            const Icon = plan.icon;
            const isRecommended = plan.tier === 'pro';

            return (
              <motion.div
                key={plan.tier}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative rounded-xl border-2 p-6 ${
                  isRecommended
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 text-xs font-medium rounded-full">
                      Recommended
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className={`w-12 h-12 mx-auto mb-4 bg-white rounded-full flex items-center justify-center shadow-sm`}>
                    <Icon className={`h-6 w-6 ${
                      plan.tier === 'pro' ? 'text-blue-600' : 'text-purple-600'
                    }`} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900">
                      {formatCurrency(plan.price)}
                    </span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  <div className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                    {plan.chatsPerDay === -1 ? 'Unlimited' : `${plan.chatsPerDay}`} chats/day
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start space-x-2 text-sm text-gray-700">
                      <ArrowRight className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={onUpgrade}
                  className="w-full"
                  variant={isRecommended ? 'primary' : 'outline'}
                >
                  Upgrade to {plan.name}
                </Button>
              </motion.div>
            );
          })}
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Your usage resets daily</p>
              <p>
                Your chat limit will reset at midnight. Upgrade now to continue chatting immediately
                or wait until tomorrow to use your free chats again.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
