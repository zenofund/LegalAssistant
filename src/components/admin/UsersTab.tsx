import React, { useState, useEffect } from 'react';
import { Users, Search, Download, Eye, CreditCard as Edit, Trash2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { Card, CardContent } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { UserEditModal } from './UserEditModal';
import { formatDate } from '../../lib/utils';

export function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          subscriptions!subscriptions_user_id_fkey (
            *,
            plan:plans (*)
          )
        `)
        .eq('subscriptions.status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading users:', error);
        showError('Failed to Load Users', 'Unable to load users. Please try refreshing the page.');
        setUsers([]);
      } else {
        setUsers(data || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      showError('Failed to Load Users', 'Unable to load users. Please try refreshing the page.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: any) => {
    setUserToEdit(user);
    setShowEditUserModal(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userToDelete.id);

      if (error) throw error;

      await loadUsers();
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      showSuccess('User Deleted', `${userToDelete.name} has been successfully deleted.`);
    } catch (error) {
      console.error('Error deleting user:', error);
      showError('Delete Failed', 'Failed to delete user. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleViewUser = (user: any) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleUpdateSuccess = () => {
    loadUsers();
    setShowEditUserModal(false);
    setUserToEdit(null);
  };

  const filteredUsers = users.filter(user =>
    (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Users Management</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Users Table */}
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
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Subscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Joined
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
                        <div className="animate-pulse flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center space-y-2">
                        <Users className="h-12 w-12 text-gray-400" />
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {searchTerm ? 'No users found' : 'No users yet'}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {searchTerm ? 'Try adjusting your search' : 'Users will appear here once they sign up'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-6 py-4 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <Users className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.role === 'super_admin'
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            : user.role === 'admin'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {user.subscriptions && user.subscriptions.length > 0 && user.subscriptions[0].plan
                            ? user.subscriptions[0].plan.name
                            : 'Free Plan'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewUser(user)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            title="Edit User"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUserToDelete(user);
                              setShowDeleteConfirm(true);
                            }}
                            title="Delete User"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* User Details Modal */}
      <Modal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        title="User Details"
        maxWidth="lg"
      >
        {selectedUser && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedUser.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedUser.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedUser.role}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Joined</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{formatDate(selectedUser.created_at)}</p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subscription</label>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {selectedUser.subscriptions && selectedUser.subscriptions.length > 0 && selectedUser.subscriptions[0].plan
                    ? selectedUser.subscriptions[0].plan.name
                    : 'Free Plan'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Status: {selectedUser.subscriptions && selectedUser.subscriptions.length > 0
                    ? selectedUser.subscriptions[0].status || 'Active'
                    : 'Free'}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowUserModal(false)}>
                Close
              </Button>
              <Button onClick={() => {
                setShowUserModal(false);
                handleEditUser(selectedUser);
              }}>
                Edit User
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* User Edit Modal */}
      <UserEditModal
        isOpen={showEditUserModal}
        onClose={() => {
          setShowEditUserModal(false);
          setUserToEdit(null);
        }}
        user={userToEdit}
        onUpdateSuccess={handleUpdateSuccess}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setUserToDelete(null);
        }}
        title="Delete User"
        maxWidth="md"
      >
        {userToDelete && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  Are you sure you want to delete this user?
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  This action cannot be undone. All user data, including chat history and documents, will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">User to be deleted:</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{userToDelete.name} ({userToDelete.email})</p>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setUserToDelete(null);
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteUser}
                loading={deleting}
              >
                Delete User
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}