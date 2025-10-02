import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Save } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

interface UserEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onUpdateSuccess: () => void;
}

export function UserEditModal({ 
  isOpen, 
  onClose, 
  user, 
  onUpdateSuccess 
}: UserEditModalProps) {
  const { user: currentUser, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name || '');
      setEmail(user.email || '');
      setRole(user.role || 'user');
    }
  }, [user, isOpen]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const updateData = {
        name: name.trim(),
        role,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      onUpdateSuccess();
      
      // If the current user was edited, refresh their profile
      if (currentUser && currentUser.id === user.id) {
        await refreshProfile();
      }
      
      onClose();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setRole(user.role || 'user');
    }
    onClose();
  };

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Edit User"
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
              <span className="font-medium text-gray-700">User ID:</span>
              <p className="text-gray-900 font-mono text-xs">{user.id}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <p className="text-gray-900">{formatDate(user.created_at)}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Last Updated:</span>
              <p className="text-gray-900">{formatDate(user.updated_at)}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Subscription:</span>
              <p className="text-gray-900">
                {user.subscriptions?.[0]?.plan?.name || 'Free Plan'}
              </p>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Edit Details</h3>
          
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter user's full name"
          />

          <Input
            label="Email Address"
            value={email}
            disabled
            helperText="Email addresses cannot be changed. Contact support for email updates."
            className="bg-gray-50"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Be careful when changing user roles. Higher roles have more permissions.
            </p>
          </div>
        </div>

        {/* Current Subscription Details */}
        {user.subscriptions?.[0] && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-3 mb-3">
              <Shield className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900">Subscription Details</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Plan:</span>
                <p className="text-gray-900">{user.subscriptions[0].plan?.name}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  user.subscriptions[0].status === 'active' 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {user.subscriptions[0].status}
                </span>
              </div>
            </div>
          </div>
        )}

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
            className="flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>Save Changes</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}