import { createContext, useContext, useState, useEffect } from 'react';
import { api, authUtils, tokenManager, userManager } from '../utils/auth';
import { toast } from 'react-toastify';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const savedToken = tokenManager.getToken();
        const savedUser = userManager.getUser();

        if (savedToken && savedUser) {
          // Verify token is still valid by fetching user data
          try {
            const response = await api.getMe(savedToken);
            setToken(savedToken);
            setUser(response.data.user);
          } catch (error) {
            // Token is invalid, clear stored data
            console.error('Token validation failed:', error);
            authUtils.clearAuthData();
            toast.error('Session expired. Please login again.');
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        authUtils.clearAuthData();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await api.login(email, password);
      
      const { token: newToken, user: newUser } = response.data;
      
      // Save to state
      setToken(newToken);
      setUser(newUser);
      
      // Save to localStorage
      authUtils.saveAuthData(newToken, newUser);
      
      toast.success('Login successful!');
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      toast.error(error.message || 'Login failed');
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      if (token) {
        await api.logout(token);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear state and localStorage regardless of API call success
      setToken(null);
      setUser(null);
      authUtils.clearAuthData();
      toast.success('Logged out successfully');
    }
  };

  // Register function (admin only)
  const register = async (userData) => {
    try {
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.register(userData, token);
      toast.success('User registered successfully!');
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Registration failed:', error);
      toast.error(error.message || 'Registration failed');
      return { success: false, error: error.message };
    }
  };

  // Check if user is authenticated
  const isAuthenticated = () => {
    return !!(token && user);
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return user && user.role === role;
  };

  // Check if user is super admin
  const isSuperAdmin = () => {
    return hasRole('super_admin');
  };

  // Check if user is admin (includes super admin)
  const isAdmin = () => {
    return hasRole('admin') || hasRole('super_admin');
  };

  // Check if user is executive
  const isExecutive = () => {
    return hasRole('executive');
  };

  // Get all users (admin only)
  const getUsers = async () => {
    try {
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.getUsers(token);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get users failed:', error);
      toast.error(error.message || 'Failed to get users');
      return { success: false, error: error.message };
    }
  };

  // Update user status (super admin only)
  const updateUserStatus = async (userId, isActive) => {
    try {
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.updateUserStatus(userId, isActive, token);
      toast.success(response.message);
      return { success: true };
    } catch (error) {
      console.error('Update user status failed:', error);
      toast.error(error.message || 'Failed to update user status');
      return { success: false, error: error.message };
    }
  };

  // Update user (super admin only)
  const updateUser = async (userId, userData) => {
    try {
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.updateUser(userId, userData, token);
      toast.success(response.message);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Update user failed:', error);
      toast.error(error.message || 'Failed to update user');
      return { success: false, error: error.message };
    }
  };

  // Update user password (super admin only)
  const updateUserPassword = async (userId, password, confirmPassword = null) => {
    try {
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.updateUserPassword(userId, password, token, confirmPassword);
      toast.success(response.message);
      return { success: true };
    } catch (error) {
      console.error('Update user password failed:', error);
      toast.error(error.message || 'Failed to update password');
      return { success: false, error: error.message };
    }
  };

  // Delete user (super admin only)
  const deleteUser = async (userId) => {
    try {
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.deleteUser(userId, token);
      toast.success(response.message);
      return { success: true };
    } catch (error) {
      console.error('Delete user failed:', error);
      toast.error(error.message || 'Failed to delete user');
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    register,
    isAuthenticated,
    hasRole,
    isSuperAdmin,
    isAdmin,
    isExecutive,
    getUsers,
    updateUserStatus,
    updateUser,
    updateUserPassword,
    deleteUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};