// Use environment variable for API URL with fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

// Debug logging for production
if (import.meta.env.PROD) {
  console.log('[Eyther] Environment:', import.meta.env.MODE);
  console.log('[Eyther] VITE_API_URL:', import.meta.env.VITE_API_URL);
  console.log('[Eyther] Using API_BASE_URL:', API_BASE_URL);
}

if (API_BASE_URL.endsWith('/api')) {
  // eslint-disable-next-line no-console
  console.warn('[Eyther] VITE_API_URL should NOT end with /api. Remove the trailing /api to avoid double /api/api in requests.');
}
const API_URL = `${API_BASE_URL}/api`;
const STORAGE_KEY_PREFIX = import.meta.env.VITE_STORAGE_KEY_PREFIX || 'eyther_';
const AUTH_TOKEN_KEY = `${STORAGE_KEY_PREFIX}auth_token`;
const AUTH_USER_KEY = `${STORAGE_KEY_PREFIX}auth_user`;

// API utility functions
export const api = {
  // Login user
  login: async (email, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }
    
    return data;
  },

  // Get current user
  getMe: async (token) => {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get user');
    }
    
    return data;
  },

  // Register new user (admin only)
  register: async (userData, token) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }
    
    return data;
  },

  // Logout user
  logout: async (token) => {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Logout failed');
    }
    
    return data;
  },

  // Get all users (admin only)
  getUsers: async (token) => {
    const response = await fetch(`${API_URL}/auth/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to get users');
    }
    
    return data;
  },

  // Update user status (super admin only)
  updateUserStatus: async (userId, isActive, token) => {
    const response = await fetch(`${API_URL}/auth/users/${userId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update user status');
    }
    
    return data;
  },

  // Update user (super admin only)
  updateUser: async (userId, userData, token) => {
    const response = await fetch(`${API_URL}/auth/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update user');
    }
    
    return data;
  },

  // Update user password (super admin only)
  updateUserPassword: async (userId, password, token, confirmPassword = null) => {
    const body = { password };
    
    // Add confirmPassword if provided
    if (confirmPassword !== null) {
      body.confirmPassword = confirmPassword;
    }
    
    const response = await fetch(`${API_URL}/auth/users/${userId}/password`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to update password');
    }
    
    return data;
  },

  // Delete user (super admin only)
  deleteUser: async (userId, token) => {
    const response = await fetch(`${API_URL}/auth/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete user');
    }
    
    return data;
  }
};

// Token management
export const tokenManager = {
  // Get token from localStorage
  getToken: () => {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  // Set token in localStorage
  setToken: (token) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  },

  // Remove token from localStorage
  removeToken: () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  },

  // Check if token exists
  hasToken: () => {
    return !!localStorage.getItem(AUTH_TOKEN_KEY);
  }
};

// User management
export const userManager = {
  // Get user from localStorage
  getUser: () => {
    const user = localStorage.getItem(AUTH_USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  // Set user in localStorage
  setUser: (user) => {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  },

  // Remove user from localStorage
  removeUser: () => {
    localStorage.removeItem(AUTH_USER_KEY);
  },

  // Check if user exists
  hasUser: () => {
    return !!localStorage.getItem(AUTH_USER_KEY);
  }
};

// Auth utilities
export const authUtils = {
  // Check if user is authenticated
  isAuthenticated: () => {
    return tokenManager.hasToken() && userManager.hasUser();
  },

  // Check if user has specific role
  hasRole: (role) => {
    const user = userManager.getUser();
    return user && user.role === role;
  },

  // Check if user is super admin
  isSuperAdmin: () => {
    return authUtils.hasRole('super_admin');
  },

  // Check if user is admin (includes super admin)
  isAdmin: () => {
    return authUtils.hasRole('admin') || authUtils.hasRole('super_admin');
  },

  // Check if user is executive
  isExecutive: () => {
    return authUtils.hasRole('executive');
  },

  // Clear all auth data
  clearAuthData: () => {
    tokenManager.removeToken();
    userManager.removeUser();
  },

  // Save auth data
  saveAuthData: (token, user) => {
    tokenManager.setToken(token);
    userManager.setUser(user);
  }
};