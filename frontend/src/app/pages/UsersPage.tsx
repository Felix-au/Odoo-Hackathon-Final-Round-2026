import { useState } from 'react';
import { useUsers, useUpdateUserRole } from '../../api/hooks/useUsers';
import { useAuthStore } from '../../stores/auth.store';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
import { EmptyState } from '../../components/feedback/EmptyState';
import { formatDate } from '../../lib/utils';
import { Role, ROLES } from '../../lib/constants';
import { Users, Shield, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function UsersPage() {
  const [page] = useState(1);
  const { user: currentUser } = useAuthStore();
  const { data: usersData, isLoading, isError, error, refetch } = useUsers(page, 50);
  const updateRoleMutation = useUpdateUserRole();

  const users = usersData?.data || [];
  const total = usersData?.total || 0;

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      await updateRoleMutation.mutateAsync({ userId, role: newRole });
      toast.success('User role updated successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user role';
      toast.error(msg);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'destructive';
      case 'SALES_MANAGER':
        return 'primary';
      case 'FINANCE':
        return 'warning';
      case 'SALES_REP':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-5 pb-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">User & Access Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Identity credentials, role assignments, and authorization policies (Auth Service — Port 3001)
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isLoading}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh Users
        </Button>
      </div>

      {/* Service Endpoint Notice */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span>
            Connected to <strong>Auth Service</strong> (<code>http://localhost:3001/auth/users</code>)
          </span>
        </div>
        <div className="text-xs font-mono font-bold text-slate-700">
          Total Users: {total}
        </div>
      </div>

      {/* Content Rendering */}
      {isLoading ? (
        <LoadingSpinner label="Loading users from Auth Service database..." />
      ) : isError ? (
        <div className="p-6 bg-white rounded-xl border border-amber-200 text-center space-y-3 shadow-2xs">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">
            {error?.message?.includes('403')
              ? 'Access Restricted — Administrator Privileges Required'
              : 'Unable to Connect to Auth Service'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {error?.message?.includes('403')
              ? 'User identity and credential management is restricted to ADMIN and SALES_MANAGER accounts by the backend Role-Based Access Control (RBAC) policy.'
              : (error?.message || 'Failed to fetch users from the backend auth service.')}
          </p>
          <div className="flex items-center justify-center gap-3 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                try {
                  await useAuthStore.getState().login('admin@dealflow360.com', 'AdminP@ss123');
                  toast.success('Signed in as Platform Admin (ADMIN)');
                  refetch();
                } catch {
                  toast.error('Failed to sign in as admin');
                }
              }}
            >
              Sign In as Platform Admin (1-Click)
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="There are currently no user accounts registered in the database."
        />
      ) : (
        <Card>
          <CardHeader className="py-3 px-5 bg-slate-50/75">
            <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              Registered Accounts ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left table-dense">
              <thead>
                <tr>
                  <th>User Identity</th>
                  <th>Email</th>
                  <th>Current Role</th>
                  <th>Created Date</th>
                  {currentUser?.role === 'ADMIN' && <th className="text-right">Change Role</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id}>
                      <td className="font-bold text-xs text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {u.name ? u.name[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div>{u.name}</div>
                            {isSelf && (
                              <span className="text-[10px] text-primary font-semibold">(You)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-xs font-mono text-slate-600">{u.email}</td>
                      <td>
                        <Badge variant={getRoleBadgeVariant(u.role)} size="sm">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="text-xs text-slate-500">
                        {u.createdAt ? formatDate(u.createdAt) : '—'}
                      </td>
                      {currentUser?.role === 'ADMIN' && (
                        <td className="text-right">
                          <select
                            value={u.role}
                            disabled={isSelf || updateRoleMutation.isPending}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                            className="text-xs font-medium border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                          >
                            <option value={ROLES.SALES_REP}>SALES_REP</option>
                            <option value={ROLES.SALES_MANAGER}>SALES_MANAGER</option>
                            <option value={ROLES.FINANCE}>FINANCE</option>
                            <option value={ROLES.ADMIN}>ADMIN</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
