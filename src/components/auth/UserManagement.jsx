import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, UserPlus, Shield, Eye, EyeOff, Edit2, Trash2, Save, X, AlertTriangle, ArrowLeft } from 'lucide-react';

const UserManagement = ({ onBack }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'admin',
    firstName: '',
    lastName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuperAdminWarning, setShowSuperAdminWarning] = useState(false);
  const [showEditSuperAdminWarning, setShowEditSuperAdminWarning] = useState(false);
  const { user: currentUser, getUsers, register, updateUserStatus, updateUser, updateUserPassword, deleteUser, isSuperAdmin } = useAuth();

  // Only super admins can access this component
  if (!isSuperAdmin()) {
    return (
      <div className="text-center p-8">
        <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-500">You don't have permission to manage users</p>
      </div>
    );
  }

  // Load users
  const loadUsers = async () => {
    setLoading(true);
    const result = await getUsers();
    if (result.success) {
      setUsers(result.data.users);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Handle user registration
  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (!newUser.email || !newUser.password || !newUser.firstName || !newUser.lastName) {
      return;
    }

    // Show warning for super admin creation
    if (newUser.role === 'super_admin' && !showSuperAdminWarning) {
      setShowSuperAdminWarning(true);
      return;
    }

    const result = await register(newUser);
    if (result.success) {
      setShowAddForm(false);
      setShowSuperAdminWarning(false);
      setNewUser({
        email: '',
        password: '',
        role: 'admin',
        firstName: '',
        lastName: ''
      });
      loadUsers(); // Refresh user list
    }
  };

  // Toggle user status
  const handleToggleStatus = async (userId, currentStatus) => {
    // Find the user to check if they're a super admin
    const user = users.find(u => u.id === userId);
    if (user && user.role === 'super_admin') {
      alert('Cannot deactivate super admin users for security reasons.');
      return;
    }

    const result = await updateUserStatus(userId, !currentStatus);
    if (result.success) {
      loadUsers(); // Refresh user list
    }
  };

  // Start editing a user
  const handleEditUser = (user) => {
    setEditingUser(user.id);
    setEditForm({
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      password: '',
      confirmPassword: ''
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({});
    setShowEditPassword(false);
    setShowConfirmPassword(false);
    setShowEditSuperAdminWarning(false);
  };

  // Save user changes
  const handleSaveUser = async (userId) => {
    const user = users.find(u => u.id === userId);
    
    // Show warning when changing someone to super admin (if they weren't already super admin)
    if (editForm.role === 'super_admin' && user.role !== 'super_admin' && !showEditSuperAdminWarning) {
      setShowEditSuperAdminWarning(true);
      return;
    }

    // Validate password confirmation if password is provided and this is changing another user's password
    if (editForm.password && userId !== currentUser?.id) {
      if (!editForm.confirmPassword) {
        alert('Please confirm the new password');
        return;
      }
      if (editForm.password !== editForm.confirmPassword) {
        alert('Password and confirmation do not match');
        return;
      }
    }

    const updateData = {
      email: editForm.email,
      firstName: editForm.firstName,
      lastName: editForm.lastName
    };

    // Only include role if not editing own account
    if (userId !== currentUser?.id) {
      updateData.role = editForm.role;
    }

    const result = await updateUser(userId, updateData);
    if (result.success) {
      // Update password if provided
      if (editForm.password) {
        // For super admin changing other users' passwords, pass confirmPassword
        const confirmPassword = userId !== currentUser?.id ? editForm.confirmPassword : null;
        const passwordResult = await updateUserPassword(userId, editForm.password, confirmPassword);
        if (!passwordResult.success) {
          return; // Don't continue if password update failed
        }
      }
      setEditingUser(null);
      setEditForm({});
      setShowEditPassword(false);
      setShowConfirmPassword(false);
      setShowEditSuperAdminWarning(false);
      loadUsers(); // Refresh user list
    }
  };

  // Delete user
  const handleDeleteUser = async (userId) => {
    // Find the user to check if they're a super admin
    const user = users.find(u => u.id === userId);
    if (user && user.role === 'super_admin') {
      alert('Cannot delete super admin users for security reasons.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      const result = await deleteUser(userId);
      if (result.success) {
        loadUsers(); // Refresh user list
      }
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2a5eb4] border-t-transparent mx-auto mb-4"></div>
        <p className="text-slate-600">Loading users...</p>
      </div>
    );
  }

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
            <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
            <p className="text-slate-600">Manage user accounts and permissions</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center px-4 py-2 bg-[#2a5eb4] text-white rounded-lg hover:bg-[#1e4a8c] transition-colors"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Add New User</h3>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                First Name
              </label>
              <input
                type="text"
                required
                value={newUser.firstName}
                onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a5eb4] focus:border-[#2a5eb4]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Last Name
              </label>
              <input
                type="text"
                required
                value={newUser.lastName}
                onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a5eb4] focus:border-[#2a5eb4]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a5eb4] focus:border-[#2a5eb4]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Role
              </label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a5eb4] focus:border-[#2a5eb4]"
              >
                <option value="admin">Admin</option>
                <option value="executive">Executive</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength="8"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a5eb4] focus:border-[#2a5eb4]"
                  placeholder="Minimum 8 characters"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Super Admin Warning */}
            {newUser.role === 'super_admin' && showSuperAdminWarning && (
              <div className="md:col-span-2 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">Super Admin Warning</p>
                    <p>You are about to create a Super Admin user. Please note:</p>
                    <ul className="mt-2 list-disc pl-4 space-y-1">
                      <li>This user will have full administrative privileges</li>
                      <li>They will be able to see and manage all users in the system</li>
                      <li>You will NOT be able to deactivate or remove this user once created</li>
                      <li>Only create Super Admin accounts for trusted administrators</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-[#2a5eb4] text-white rounded-lg hover:bg-[#1e4a8c] transition-colors"
              >
                {newUser.role === 'super_admin' && showSuperAdminWarning ? 'Confirm Create Super Admin' : 'Add User'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setShowSuperAdminWarning(false);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">All Users ({users.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-[#2a5eb4] flex items-center justify-center">
                          <User className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="ml-4">
                        {editingUser === user.id ? (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editForm.firstName || ''}
                                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                                className="text-sm px-2 py-1 border border-slate-300 rounded w-20"
                                placeholder="First"
                              />
                              <input
                                type="text"
                                value={editForm.lastName || ''}
                                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                                className="text-sm px-2 py-1 border border-slate-300 rounded w-20"
                                placeholder="Last"
                              />
                            </div>
                            <input
                              type="email"
                              value={editForm.email || ''}
                              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                              className="text-sm px-2 py-1 border border-slate-300 rounded w-full"
                              placeholder="Email"
                            />
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <input
                                  type={showEditPassword ? 'text' : 'password'}
                                  value={editForm.password || ''}
                                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                  className="text-sm px-2 py-1 pr-8 border border-slate-300 rounded w-full"
                                  placeholder="New password (optional)"
                                />
                                <button
                                  type="button"
                                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                                  onClick={() => setShowEditPassword(!showEditPassword)}
                                >
                                  {showEditPassword ? (
                                    <EyeOff className="h-3 w-3 text-slate-400" />
                                  ) : (
                                    <Eye className="h-3 w-3 text-slate-400" />
                                  )}
                                </button>
                              </div>
                            </div>
                            {/* Show password confirmation field only when changing another user's password */}
                            {editForm.password && user.id !== currentUser?.id && (
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={editForm.confirmPassword || ''}
                                    onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                                    className="text-sm px-2 py-1 pr-8 border border-slate-300 rounded w-full"
                                    placeholder="Confirm new password"
                                  />
                                  <button
                                    type="button"
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  >
                                    {showConfirmPassword ? (
                                      <EyeOff className="h-3 w-3 text-slate-400" />
                                    ) : (
                                      <Eye className="h-3 w-3 text-slate-400" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {`${user.firstName} ${user.lastName}`}
                            </div>
                            <div className="text-sm text-slate-500">
                              {user.email}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingUser === user.id ? (
                      <div className="space-y-2">
                        <select
                          value={editForm.role || ''}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                          disabled={user.id === currentUser?.id}
                          className={`text-sm px-2 py-1 border border-slate-300 rounded ${
                            user.id === currentUser?.id ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                          }`}
                        >
                          <option value="admin">Admin</option>
                          <option value="executive">Executive</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                        {user.id === currentUser?.id && (
                          <p className="text-xs text-slate-500">You cannot change your own role</p>
                        )}
                        {/* Super Admin Edit Warning */}
                        {editForm.role === 'super_admin' && user.role !== 'super_admin' && showEditSuperAdminWarning && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                            <div className="flex items-start">
                              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                              <div className="text-xs text-red-800">
                                <p className="font-semibold mb-1">Super Admin Warning</p>
                                <p className="mb-1">You are promoting this user to Super Admin:</p>
                                <ul className="list-disc pl-3 space-y-1">
                                  <li>They will have full administrative privileges</li>
                                  <li>They can manage all users in the system</li>
                                  <li>You will NOT be able to deactivate or remove them</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        user.role === 'super_admin' 
                          ? 'bg-red-100 text-red-800'
                          : user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      {editingUser === user.id ? (
                        <>
                          <button
                            onClick={() => handleSaveUser(user.id)}
                            className="inline-flex items-center px-2 py-1 rounded-md text-sm text-green-600 hover:text-green-900 hover:bg-green-50 transition-colors"
                            title={editForm.role === 'super_admin' && user.role !== 'super_admin' && showEditSuperAdminWarning ? 'Confirm Super Admin Promotion' : 'Save Changes'}
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="inline-flex items-center px-2 py-1 rounded-md text-sm text-red-600 hover:text-red-900 hover:bg-red-50 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditUser(user)}
                            className="inline-flex items-center px-2 py-1 rounded-md text-sm text-blue-600 hover:text-blue-900 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {user.role === 'super_admin' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-sm text-slate-400 bg-slate-50 cursor-not-allowed">
                              Protected
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleToggleStatus(user.id, user.isActive)}
                                className={`inline-flex items-center px-2 py-1 rounded-md text-sm ${
                                  user.isActive
                                    ? 'text-orange-600 hover:text-orange-900 hover:bg-orange-50'
                                    : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                } transition-colors`}
                              >
                                {user.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="inline-flex items-center px-2 py-1 rounded-md text-sm text-red-600 hover:text-red-900 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-8">
            <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;