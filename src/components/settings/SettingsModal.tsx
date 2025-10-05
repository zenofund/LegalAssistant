import React, { useState, useEffect } from 'react';
import { User, CreditCard, Bell, Shield, HelpCircle, Moon, Sun } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../contexts/ThemeContext';
import { formatCurrency } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'profile' | 'subscription' | 'notifications' | 'security';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { profile, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'subscription' as const, label: 'Subscription', icon: CreditCard },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'security' as const, label: 'Security', icon: Shield },
  ];

  if (!profile) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      maxWidth="2xl"
    >
      <div className="flex flex-col lg:flex-row lg:h-96">
        {/* Tabs */}
        <div className="w-full lg:w-48 lg:border-r border-gray-200 dark:border-gray-700 lg:pr-4 mb-4 lg:mb-0">
          <nav className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible space-x-2 lg:space-x-0 lg:space-y-1 pb-2 lg:pb-0 border-b lg:border-b-0 border-gray-200 dark:border-gray-700">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 lg:pl-6">
          {activeTab === 'profile' && <ProfileSettings profile={profile} updateProfile={updateProfile} />}
          {activeTab === 'subscription' && <SubscriptionSettings profile={profile} />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && <SecuritySettings />}
        </div>
      </div>
    </Modal>
  );
}

function ProfileSettings({ profile, updateProfile }: any) {
  const [name, setName] = useState(profile.name);
  const [isLoading, setIsLoading] = useState(false);
  const { showSuccess, showError } = useToast();
  const { theme, toggleTheme } = useTheme();

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = await updateProfile({ name });
      if (result.error) {
        console.error('Profile update error:', result.error);
        showError('Update Failed', 'Failed to update your profile. Please try again.');
      } else {
        console.log('Profile updated successfully');
        showSuccess('Profile Updated', 'Your profile has been updated successfully.');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showError('Update Failed', 'An unexpected error occurred while updating your profile.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Profile Information</h3>
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Email"
            value={profile.email}
            disabled
            helperText="Contact support to change your email address"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              loading={isLoading}
              disabled={name === profile.name}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">Theme</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Switch between light and dark mode</p>
          </div>
          <Button
            variant="outline"
            onClick={toggleTheme}
            className="flex items-center space-x-2"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                <span>Dark</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionSettings({ profile }: any) {
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [currentChatCount, setCurrentChatCount] = useState(0);
  const [maxChatLimit, setMaxChatLimit] = useState(50);
  const [currentDocumentCount, setCurrentDocumentCount] = useState(0);
  const [maxDocumentLimit, setMaxDocumentLimit] = useState(10);

  useEffect(() => {
    if (profile) {
      loadUsageData();
    }
  }, [profile]);

  const loadUsageData = async () => {
    if (!profile) {
      setLoadingUsage(false);
      return;
    }

    setLoadingUsage(true);
    try {
      // Get current chat count for today using RPC function
      const { data: currentChatUsage, error: usageError } = await supabase
        .rpc('get_usage_count_today', {
          p_user_id: profile.id,
          p_feature: 'chat_message'
        });

      if (usageError) {
        console.error('Error loading usage data:', usageError);
      }

      setCurrentChatCount(currentChatUsage || 0);

      // Get document count
      const { count: docCount, error: docError } = await supabase
        .from('documents')
        .select('id', { count: 'exact' })
        .eq('uploaded_by', profile.id);

      if (docError) {
        console.error('Error loading document count:', docError);
      } else {
        setCurrentDocumentCount(docCount || 0);
      }

      // Get limits from current plan
      const currentPlan = profile?.subscription?.plan;
      setMaxChatLimit(currentPlan?.max_chats_per_day || 50);
      setMaxDocumentLimit(currentPlan?.max_documents || 10);

    } catch (error) {
      console.error('Error loading usage data:', error);
    } finally {
      setLoadingUsage(false);
    }
  };

  const subscription = profile?.subscription;
  const plan = subscription?.plan;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Subscription Details</h3>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold">{plan?.name || 'Free Plan'}</h4>
                <p className="text-sm text-gray-600">
                  {plan?.tier === 'free' ? 'No billing' : `${formatCurrency(plan?.price || 0)} per ${plan?.billing_cycle || 'month'}`}
                </p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  subscription?.status === 'active' 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {subscription?.status || 'Free'}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingUsage ? (
              <div className="space-y-3">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Documents uploaded:</span>
                  <span className="font-medium">
                    {maxDocumentLimit === -1 ? 'Unlimited' : `${currentDocumentCount} / ${maxDocumentLimit}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Daily chat messages:</span>
                  <span className="font-medium">
                    {maxChatLimit === -1 ? 'Unlimited' : `${currentChatCount} / ${maxChatLimit}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Internet search:</span>
                  <span className="font-medium">
                    {plan?.internet_search ? (
                      <span className="text-green-600">✓ Real-time search enabled</span>
                    ) : (
                      <span className="text-gray-500">Not available</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Citation Generator:</span>
                  <span className="font-medium">
                    {plan?.tier === 'pro' || plan?.tier === 'enterprise' ? (
                      <span className="text-green-600">✓ NWLR, FWLR formats</span>
                    ) : (
                      <span className="text-gray-500">Not available</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Case Summarizer:</span>
                  <span className="font-medium">
                    {plan?.tier === 'pro' || plan?.tier === 'enterprise' ? (
                      <span className="text-green-600">✓ Facts, Issues, Ratio/Obiter</span>
                    ) : (
                      <span className="text-gray-500">Not available</span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {(!plan || plan?.tier === 'free') && (
          <div className="mt-4">
            <Button className="w-full">
              Upgrade to Pro Plan
            </Button>
            <p className="text-xs text-gray-500 text-center mt-2">
              Get advanced features, unlimited documents, and priority support
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Notification Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Email Notifications</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Receive updates about your account</p>
            </div>
            <input type="checkbox" className="rounded" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Security Alerts</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Get notified about security events</p>
            </div>
            <input type="checkbox" className="rounded" defaultChecked />
          </div>
        </div>
      </div>
    </div>
  );
}

function SecuritySettings() {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showFeatureComingSoon, setShowFeatureComingSoon] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showError('Validation Error', 'Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Validation Error', 'New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      showError('Validation Error', 'New password must be at least 6 characters long.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      showSuccess('Password Changed', 'Your password has been successfully updated.');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      showError('Update Failed', error.message || 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Security Settings</h3>
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowChangePassword(true)}
            >
              Change Password
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowFeatureComingSoon(true)}
            >
              Two-Factor Authentication
            </Button>
            <Button variant="destructive" className="w-full justify-start">
              Delete Account
            </Button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={showChangePassword}
        onClose={() => {
          setShowChangePassword(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        }}
        title="Change Password"
        maxWidth="md"
      >
        <div className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter your current password"
          />
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter your new password"
            helperText="Must be at least 6 characters long"
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your new password"
          />
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowChangePassword(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }}
              disabled={isChangingPassword}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              loading={isChangingPassword}
            >
              Change Password
            </Button>
          </div>
        </div>
      </Modal>

      {/* Feature Coming Soon Modal */}
      <Modal
        isOpen={showFeatureComingSoon}
        onClose={() => setShowFeatureComingSoon(false)}
        title="Coming Soon"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="text-center py-6">
            <Shield className="h-16 w-16 mx-auto text-blue-600 dark:text-blue-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Two-Factor Authentication
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              This feature is coming soon! We're working hard to bring you enhanced security options.
            </p>
          </div>
          <div className="flex justify-center">
            <Button onClick={() => setShowFeatureComingSoon(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}