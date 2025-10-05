import React, { useState, useEffect, Component, ReactNode, ErrorInfo } from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, CreditCard, MessageSquare, TrendingUp, Settings, Bell, Plus, CreditCard as Edit, Trash2, Eye, Download, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, hasPermission } from '../../lib/supabase';
import { formatCurrency, formatDate, formatRelativeTime } from '../../lib/utils';
import { SubscriptionDetailsModal } from './SubscriptionDetailsModal';
import { UsersTab } from './UsersTab';
import { DocumentsTab } from './DocumentsTab';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button'; // Assuming Button component exists
import { Modal } from '../ui/Modal'; // Assuming Modal component exists
import { Input } from '../ui/Input'; // Assuming Input component exists
import { ErrorBoundary } from '../ErrorBoundary';

interface AdminStats {
  totalUsers: number;
  totalDocuments: number;
  totalRevenue: number;
  totalChats: number;
  activeSubscriptions: number;
  monthlyGrowth: number;
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'documents' | 'subscriptions' | 'notifications'>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && hasPermission(profile.role, ['admin', 'super_admin'])) {
      loadAdminStats();
    }
  }, [profile]);

  const loadAdminStats = async () => {
    try {
      const [usersRes, docsRes, transactionsRes, chatsRes, subsRes] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact' }),
        supabase.from('documents').select('id', { count: 'exact' }),
        supabase.from('transactions').select('amount').eq('status', 'success'),
        supabase.from('chats').select('id', { count: 'exact' }),
        supabase.from('subscriptions').select('id', { count: 'exact' }).eq('status', 'active')
      ]);

      const totalRevenue = transactionsRes.data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      setStats({
        totalUsers: usersRes.count || 0,
        totalDocuments: docsRes.count || 0,
        totalRevenue,
        totalChats: chatsRes.count || 0,
        activeSubscriptions: subsRes.count || 0,
        monthlyGrowth: 12.5 // This would be calculated from historical data
      });
    } catch (error) {
      console.error('Error loading admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!profile || !hasPermission(profile.role, ['admin', 'super_admin'])) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access the admin dashboard.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: TrendingUp },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'documents' as const, label: 'Documents', icon: FileText },
    { id: 'subscriptions' as const, label: 'Subscriptions', icon: CreditCard },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  onBlur={() => setTimeout(() => setShowUserMenu(false), 200)}
                  className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none"
                >
                  <span>Welcome, <span className="font-medium">{profile.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span></span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{profile.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        window.dispatchEvent(new CustomEvent('openSettings'));
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Admin Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        window.location.href = '/';
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Chat Dashboard</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          {/* Mobile/Tablet Dropdown */}
          <div className="md:hidden">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>
          {/* Desktop Tabs */}
          <nav className="hidden md:flex space-x-8 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content - WRAPPED WITH ERROR BOUNDARY */}
        <ErrorBoundary>
            {activeTab === 'overview' && <OverviewTab stats={stats} loading={loading} />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'documents' && <DocumentsTab />}
            {activeTab === 'subscriptions' && <SubscriptionsTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
        </ErrorBoundary>
      </div>
    </div>
  );
}

function OverviewTab({ stats, loading }: { stats: AdminStats | null; loading: boolean }) {
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    loadRecentActivity();
  }, []);

  const loadRecentActivity = async () => {
    try {
      const activities: any[] = [];

      // Get recent users (last 10)
      const { data: recentUsers } = await supabase
        .from('users')
        .select('id, name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentUsers) {
        recentUsers.forEach(user => {
          activities.push({
            type: 'user',
            icon: Users,
            iconColor: 'bg-blue-100 dark:bg-blue-900',
            iconTextColor: 'text-blue-600 dark:text-blue-400',
            title: 'New user registered',
            description: user.name || user.email,
            timestamp: user.created_at
          });
        });
      }

      // Get recent documents (last 10)
      const { data: recentDocs } = await supabase
        .from('documents')
        .select('id, title, user_id, created_at, users(name, email)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentDocs) {
        recentDocs.forEach(doc => {
          activities.push({
            type: 'document',
            icon: FileText,
            iconColor: 'bg-emerald-100 dark:bg-emerald-900',
            iconTextColor: 'text-emerald-600 dark:text-emerald-400',
            title: 'Document uploaded',
            description: doc.title,
            timestamp: doc.created_at
          });
        });
      }

      // Get recent successful transactions (last 10)
      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('id, amount, status, created_at, users(name, email)')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentTransactions) {
        recentTransactions.forEach(tx => {
          activities.push({
            type: 'payment',
            icon: CreditCard,
            iconColor: 'bg-amber-100 dark:bg-amber-900',
            iconTextColor: 'text-amber-600 dark:text-amber-400',
            title: 'Payment received',
            description: `${formatCurrency(tx.amount)} from ${tx.users?.name || tx.users?.email || 'Unknown'}`,
            timestamp: tx.created_at
          });
        });
      }

      // Sort all activities by timestamp and take the most recent 15
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities.slice(0, 15));
    } catch (error) {
      console.error('Error loading recent activity:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent>
              <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'bg-blue-500',
      change: '+12%'
    },
    {
      title: 'Documents',
      value: stats?.totalDocuments || 0,
      icon: FileText,
      color: 'bg-emerald-500',
      change: '+8%'
    },
    {
      title: 'Revenue',
      value: formatCurrency(stats?.totalRevenue || 0),
      icon: CreditCard,
      color: 'bg-amber-500',
      change: '+15%'
    },
    {
      title: 'Chat Messages',
      value: stats?.totalChats || 0,
      icon: MessageSquare,
      color: 'bg-purple-500',
      change: '+25%'
    },
    {
      title: 'Active Subscriptions',
      value: stats?.activeSubscriptions || 0,
      icon: TrendingUp,
      color: 'bg-rose-500',
      change: '+18%'
    },
    {
      title: 'Monthly Growth',
      value: `${stats?.monthlyGrowth || 0}%`,
      icon: TrendingUp,
      color: 'bg-indigo-500',
      change: '+3%'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.title}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                      <p className="text-sm text-green-600 dark:text-green-400 mt-1">{stat.change} from last month</p>
                    </div>
                    <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Activity</h3>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {recentActivity.map((activity, index) => {
                const Icon = activity.icon;
                const timeAgo = formatRelativeTime(activity.timestamp);

                return (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <div className={`w-8 h-8 ${activity.iconColor} rounded-full flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`h-4 w-4 ${activity.iconTextColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{activity.title}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{activity.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{timeAgo}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SubscriptionsTab() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubscriptionDetailsModal, setShowSubscriptionDetailsModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          user:users(name, email),
          plan:plans(name, price, tier)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
      // This is where the Error Boundary will catch the error if you re-throw it
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleViewSubscription = (subscription: any) => {
    setSelectedSubscription(subscription);
    setShowSubscriptionDetailsModal(true);
  };

  const handleUpdateSuccess = () => {
    loadSubscriptions();
    setShowSubscriptionDetailsModal(false);
    setSelectedSubscription(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Subscriptions Management</h2>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-6 py-4 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                        <div className="animate-pulse space-y-2">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : (
                  subscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-6 py-4 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{sub.user?.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{sub.user?.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900 dark:text-gray-100">{sub.plan?.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          sub.status === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : sub.status === 'cancelled'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {formatCurrency(sub.plan?.price || 0)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {sub.start_date ? formatDate(sub.start_date) : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewSubscription(sub)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Details Modal */}
      <SubscriptionDetailsModal
        isOpen={showSubscriptionDetailsModal}
        onClose={() => {
          setShowSubscriptionDetailsModal(false);
          setSelectedSubscription(null);
        }}
        subscription={selectedSubscription}
        onUpdateSuccess={handleUpdateSuccess}
      />
    </div>
  );
}

function NotificationsTab() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNotificationTitle, setNewNotificationTitle] = useState('');
  const [newNotificationMessage, setNewNotificationMessage] = useState('');
  const [newNotificationType, setNewNotificationType] = useState('info');
  const [newNotificationTargetRoles, setNewNotificationTargetRoles] = useState(['user']);
  const [newNotificationExpiresAt, setNewNotificationExpiresAt] = useState('');
  const [isCreatingNotification, setIsCreatingNotification] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotification = async () => {
    if (!newNotificationTitle.trim() || !newNotificationMessage.trim()) {
      alert('Please fill in both title and message fields.');
      return;
    }

    setIsCreatingNotification(true);

    try {
      const notificationData = {
        title: newNotificationTitle.trim(),
        message: newNotificationMessage.trim(),
        type: newNotificationType,
        target_roles: newNotificationTargetRoles,
        expires_at: newNotificationExpiresAt ? new Date(newNotificationExpiresAt).toISOString() : null,
        is_active: true
      };

      const { error } = await supabase
        .from('admin_notifications')
        .insert(notificationData);

      if (error) throw error;

      // Reset form state
      setNewNotificationTitle('');
      setNewNotificationMessage('');
      setNewNotificationType('info');
      setNewNotificationTargetRoles(['user']);
      setNewNotificationExpiresAt('');
      setShowCreateModal(false);

      // Refresh notifications list
      await loadNotifications();

    } catch (error) {
      console.error('Error creating notification:', error);
      alert('Failed to create notification. Please try again.');
    } finally {
      setIsCreatingNotification(false);
    }
  };

  const handleTargetRolesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setNewNotificationTargetRoles(selectedOptions);
  };

  const handleCancelCreate = () => {
    // Reset form state
    setNewNotificationTitle('');
    setNewNotificationMessage('');
    setNewNotificationType('info');
    setNewNotificationTargetRoles(['user']);
    setNewNotificationExpiresAt('');
    setShowCreateModal(false);
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Notifications</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Notification
        </Button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          notifications.map((notification) => (
            <Card key={notification.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {notification.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        notification.type === 'error' 
                          ? 'bg-red-100 text-red-800'
                          : notification.type === 'warning'
                          ? 'bg-yellow-100 text-yellow-800'
                          : notification.type === 'success'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {notification.type}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        notification.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {notification.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{notification.message}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>Target: {notification.target_roles.join(', ')}</span>
                      <span>Created: {formatDate(notification.created_at)}</span>
                      {notification.expires_at && (
                        <span>Expires: {formatDate(notification.expires_at)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Notification Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCancelCreate}
        title="Create System Notification"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <Input 
            label="Title" 
            placeholder="Enter notification title"
            value={newNotificationTitle}
            onChange={(e) => setNewNotificationTitle(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder="Enter notification message"
              value={newNotificationMessage}
              onChange={(e) => setNewNotificationMessage(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={newNotificationType}
                onChange={(e) => setNewNotificationType(e.target.value)}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="success">Success</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Roles</label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                multiple
                value={newNotificationTargetRoles}
                onChange={handleTargetRolesChange}
              >
                <option value="user">Users</option>
                <option value="admin">Admins</option>
                <option value="super_admin">Super Admins</option>
                <option value="all">All Users</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple roles</p>
            </div>
          </div>
          <Input 
            label="Expires At (Optional)" 
            type="datetime-local"
            value={newNotificationExpiresAt}
            onChange={(e) => setNewNotificationExpiresAt(e.target.value)}
          />
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={handleCancelCreate} disabled={isCreatingNotification}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateNotification}
              // loading={isCreatingNotification} // Assuming your button has a loading prop
            >
              {isCreatingNotification ? 'Creating...' : 'Create Notification'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
