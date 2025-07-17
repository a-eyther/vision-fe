import { useAuth } from '../../contexts/AuthContext';

const ProtectedRoute = ({ children, requireRole = null }) => {
  const { isAuthenticated, hasRole, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2a5eb4] border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render children (App will show Login)
  if (!isAuthenticated()) {
    return null;
  }

  // If specific role is required and user doesn't have it
  if (requireRole) {
    // Handle multiple roles
    const roles = Array.isArray(requireRole) ? requireRole : [requireRole];
    const hasRequiredRole = roles.some(role => hasRole(role));
    
    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
              <div className="text-red-500 text-6xl mb-4">🚫</div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
              <p className="text-slate-600 mb-4">
                You don't have permission to access this resource.
              </p>
              <p className="text-sm text-slate-500">
                Required role: <span className="font-medium">{roles.join(' or ')}</span>
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  // User is authenticated and has required role (if any)
  return children;
};

export default ProtectedRoute;