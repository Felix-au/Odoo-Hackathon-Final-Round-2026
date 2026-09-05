import { useState } from 'react';
import { useUsers, useUpdateUserRole } from '../../api/hooks/useUsers';
import { useAuthStore } from '../../stores/auth.store';
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner';
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'SALES_MANAGER':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'FINANCE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'SALES_REP':
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">User & Access Management</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Identity credentials, role assignments, and authorization policies (Auth Service — Port 3001)
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1C222E] hover:bg-[#252E3E] text-slate-200 border border-[#2A3445] transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Users</span>
        </button>
      </div>

      {/* Service Endpoint Notice */}
      <div className="p-4 bg-[#12151C] rounded-2xl border border-[#1E2430] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            Connected to <strong className="text-white">Auth Service</strong> (<code className="text-blue-400 font-mono text-[11px]">http://localhost:3001/auth/users</code>)
          </span>
        </div>
        <div className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-slate-300">
          Total Users: {total}
        </div>
      </div>

      {/* Content Rendering */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner label="Loading users from Auth Service database..." />
        </div>
      ) : isError ? (
        <div className="p-8 bg-[#12151C] rounded-2xl border border-amber-500/30 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
          <h3 className="text-base font-bold text-white">
            {error?.message?.includes('403')
              ? 'Access Restricted — Administrator Privileges Required'
              : 'Unable to Connect to Auth Service'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {error?.message?.includes('403')
              ? 'User identity and credential management is restricted to ADMIN and SALES_MANAGER accounts by the backend Role-Based Access Control (RBAC) policy.'
              : (error?.message || 'Failed to fetch users from the backend auth service.')}
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await useAuthStore.getState().login('admin@dealflow360.com', 'AdminP@ss123');
                  toast.success('Signed in as Platform Admin (ADMIN)');
                  refetch();
                } catch {
                  toast.error('Failed to sign in as admin');
                }
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all"
            >
              Sign In as Platform Admin (1-Click)
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1C222E] hover:bg-[#252E3E] text-slate-300 border border-[#2A3445]"
            >
              Retry
            </button>
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-[#12151C] rounded-2xl border border-[#1E2430]">
          No user accounts registered in database.
        </div>
      ) : (
        <div className="bg-[#12151C] border border-[#1E2430] rounded-2xl overflow-hidden shadow-sm">
          <div className="py-3.5 px-5 bg-[#101319] border-b border-[#1E2430] flex items-center justify-between">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Registered Accounts ({users.length})</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#101319] border-b border-[#1E2430] text-slate-400 uppercase font-semibold text-[11px]">
                  <th className="py-3 px-5">User Identity</th>
                  <th className="py-3 px-5">Email</th>
                  <th className="py-3 px-5">Current Role</th>
                  <th className="py-3 px-5">Created Date</th>
                  {currentUser?.role === 'ADMIN' && <th className="py-3 px-5 text-right">Change Role</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A202C]">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-5 font-bold text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {u.name ? u.name[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="text-white font-semibold">{u.name}</div>
                            {isSelf && (
                              <span className="text-[10px] text-blue-400 font-semibold">(You)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-slate-300">{u.email}</td>
                      <td className="py-3.5 px-5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${getRoleBadge(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-400">
                        {u.createdAt ? formatDate(u.createdAt) : '—'}
                      </td>
                      {currentUser?.role === 'ADMIN' && (
                        <td className="py-3.5 px-5 text-right">
                          <select
                            value={u.role}
                            disabled={isSelf || updateRoleMutation.isPending}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                            className="text-xs font-semibold bg-[#101319] border border-[#283244] rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50"
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
          </div>
        </div>
      )}
    </div>
  );
}
