import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, Eye, EyeOff, Save, ArrowLeft, Lock } from 'lucide-react';

const UserProfile = ({ onBack }) => {
  const { user, updateUserPassword, isSuperAdmin } = useAuth();
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordChangeMode, setPasswordChangeMode] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    setIsChangingPassword(true);
    
    try {
      const result = await updateUserPassword(user.id, passwordForm.newPassword);
      if (result.success) {
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setPasswordChangeMode(false);
      }
    } catch (error) {
      console.error('Password change failed:', error);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCancelPasswordChange = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordChangeMode(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex justify-between items-start">
        <div className="flex items-start space-x-4">
          {/* Back Button */}
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center p-2 text-slate-600 hover:text-slate-900 transition-colors mt-1"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Profile Settings</h2>
            <p className="text-slate-600">Manage your account information</p>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-16 h-16 bg-[#2a5eb4] rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-slate-900">
              {user?.firstName} {user?.lastName}
            </h3>
            <p className="text-slate-600">{user?.email}</p>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize mt-1">
              {user?.role?.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-6">
          <h4 className="text-lg font-medium text-slate-900 mb-4">Account Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Name
              </label>
              <div className="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500">
                {user?.firstName}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Last Name
              </label>
              <div className="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500">
                {user?.lastName}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <div className="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500">
                {user?.email}
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-4">
            {isSuperAdmin() 
              ? 'Visit the User Management section to edit your personal information.'
              : 'Contact your administrator to change your personal information.'
            }
          </p>
        </div>
      </div>

      {/* Password Change Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h4 className="text-lg font-medium text-slate-900">Change Password</h4>
            <p className="text-slate-600">Update your account password</p>
          </div>
          {!passwordChangeMode && (
            <button
              onClick={() => setPasswordChangeMode(true)}
              className="inline-flex items-center px-4 py-2 bg-[#2a5eb4] text-white rounded-lg hover:bg-[#1e4a8c] transition-colors"
            >
              <Lock className="w-4 h-4 mr-2" />
              Change Password
            </button>
          )}
        </div>

        {passwordChangeMode ? (
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  required
                  minLength="8"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a5eb4] focus:border-[#2a5eb4]"
                  placeholder="Enter new password (minimum 8 characters)"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                >
                  {showPasswords.new ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  required
                  minLength="8"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a5eb4] focus:border-[#2a5eb4]"
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="inline-flex items-center px-4 py-2 bg-[#2a5eb4] text-white rounded-lg hover:bg-[#1e4a8c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isChangingPassword ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Changing...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Change Password
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelPasswordChange}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Lock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>Click "Change Password" to update your password</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;