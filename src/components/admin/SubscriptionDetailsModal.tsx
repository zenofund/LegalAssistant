import React, { useState, useEffect } from 'react';
import { Calendar, CreditCard, User, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/utils';

interface SubscriptionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: any;
  onUpdateSuccess: () => void;
}

export function SubscriptionDetailsModal({ 
  isOpen, 
  onClose, 
  subscription, 
  onUpdateSuccess 
}: SubscriptionDetailsModalProps) {
  const [status, setStatus] = useState('');
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (subscription && isOpen) {
      setStatus(subscription.status || 'active');
      setPlanId(subscription.plan_id || '');
      setStartDate(subscription.start_date ? subscription.start_date.split('T')[0] : '');
      setEndDate(subscription.end_date ? subscription.end_date.split('T')[0] : '');
      setAutoRenew(subscription.auto_renew ?? true);
      loadPlans();
    }
  }, [subscription, isOpen]);

  const loadPlans = async () => {
    setLoadingPlans(true);
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;
      setAvailablePlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleSave = async () => {
    if (!subscription) return;

    setSaving(true);
    try {
      const updateData: any = {
        status,
        plan_id: planId,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        auto_renew: autoRenew,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('id', subscription.id);

      if (error) throw error;

      onUpdateSuccess();
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Failed to update subscription. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    if (subscription) {
      setStatus(subscription.status || 'active');
      setPlanId(subscription.plan_id || '');
      setStartDate(subscription.start_date ? subscription.start_date.split('T')[0] : '');
      setEndDate(subscription.end_date ? subscription.end_date.split('T')[0] : '');
      setAutoRenew(subscription.auto_renew ?? true);
    }
    onClose();
  };

  if (!subscription) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Subscription Details"
      maxWidth="lg"
    >
      <div className="space-y-6">
        {/* User Information */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <User className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">User Information</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Name:</span>
              <p className="text-gray-900">{subscription.user?.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Email:</span>
              <p className="text-gray-900">{subscription.user?.email}</p>
            </div>
          </div>
        </div>

        {/* Current Plan Information */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">Current Plan</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Plan:</span>
              <p className="text-gray-900">{subscription.plan?.name}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Price:</span>
              <p className="text-gray-900">
                {subscription.plan?.price === 0 
                  ? 'Free' 
                  : `${formatCurrency(subscription.plan?.price)} per ${subscription.plan?.billing_cycle}`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Edit Subscription</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loadingPlans}
              >
                <option value="">Select a plan</option>
                {availablePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - {plan.price === 0 ? 'Free' : formatCurrency(plan.price)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <Input
              label="End Date (Optional)"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="autoRenew"
              checked={autoRenew}
              onChange={(e) => setAutoRenew(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="autoRenew" className="text-sm font-medium text-gray-700">
              Auto-renew subscription
            </label>
          </div>
        </div>

        {/* Payment Information */}
        {subscription.paystack_subscription_code && (
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center space-x-3 mb-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <h3 className="text-lg font-medium text-gray-900">Payment Information</h3>
            </div>
            <div className="text-sm space-y-2">
              <div>
                <span className="font-medium text-gray-700">Paystack Subscription Code:</span>
                <p className="text-gray-900 font-mono text-xs">{subscription.paystack_subscription_code}</p>
              </div>
              {subscription.paystack_customer_code && (
                <div>
                  <span className="font-medium text-gray-700">Customer Code:</span>
                  <p className="text-gray-900 font-mono text-xs">{subscription.paystack_customer_code}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subscription Dates */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <Calendar className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">Subscription Timeline</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <p className="text-gray-900">{formatDate(subscription.created_at)}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Last Updated:</span>
              <p className="text-gray-900">{formatDate(subscription.updated_at)}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}