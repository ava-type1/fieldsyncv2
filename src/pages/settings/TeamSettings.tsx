import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, MoreVertical, Mail, Phone, Shield, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import type { User, UserRole } from '../../types';

const roleLabels: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  dispatcher: 'Dispatcher',
  technician: 'Technician',
  viewer: 'Viewer',
};

const roleColors: Record<UserRole, string> = {
  owner: 'bg-purple-100 text-purple-700',
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  dispatcher: 'bg-green-100 text-green-700',
  technician: 'bg-yellow-100 text-yellow-700',
  viewer: 'bg-gray-100 text-gray-700',
};

export function TeamSettings() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('technician');
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadTeamMembers();
  }, [currentUser]);

  const loadTeamMembers = async () => {
    if (!currentUser?.organizationId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('organization_id', currentUser.organizationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform snake_case to camelCase
      const transformed = data.map((u: any) => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
        avatarUrl: u.avatar_url,
        organizationId: u.organization_id,
        role: u.role,
        permissions: u.permissions || [],
        isActive: u.is_active,
        lastActiveAt: u.last_active_at,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      }));

      setTeamMembers(transformed);
    } catch (err) {
      console.error('Error loading team:', err);
      setMessage({ type: 'error', text: 'Failed to load team members' });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !currentUser?.organizationId) return;

    setInviting(true);
    setMessage(null);

    try {
      // In a real app, this would send an invite email
      // For now, we'll create a placeholder user
      const { error } = await supabase
        .from('users')
        .insert({
          email: inviteEmail,
          full_name: inviteEmail.split('@')[0],
          organization_id: currentUser.organizationId,
          role: inviteRole,
          permissions: [],
          is_active: false, // Will be activated when they accept invite
        });

      if (error) throw error;

      setMessage({ type: 'success', text: `Invite sent to ${inviteEmail}` });
      setInviteEmail('');
      setShowInviteModal(false);
      loadTeamMembers();
    } catch (err: any) {
      console.error('Error inviting user:', err);
      setMessage({ 
        type: 'error', 
        text: err.message?.includes('duplicate') 
          ? 'User already exists' 
          : 'Failed to send invite' 
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) throw error;

      loadTeamMembers();
      setMessage({ type: 'success', text: 'Team member removed' });
    } catch (err) {
      console.error('Error removing member:', err);
      setMessage({ type: 'error', text: 'Failed to remove team member' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Team Members</h1>
              <p className="text-sm text-gray-500">{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowInviteModal(true)}>
            <UserPlus className="w-4 h-4 mr-1" />
            Invite
          </Button>
        </div>
      </div>

      {message && (
        <div className={`mx-4 mt-4 p-3 rounded-lg text-sm ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700' 
            : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Team List */}
      <div className="bg-white mt-4 mx-4 rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100">
        {teamMembers.map((member) => (
          <div key={member.id} className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt={member.fullName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-lg font-semibold text-blue-600">
                  {member.fullName?.charAt(0) || member.email.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900 truncate">
                  {member.fullName || 'Pending Invite'}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[member.role]}`}>
                  {roleLabels[member.role]}
                </span>
                {!member.isActive && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                    Pending
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm text-gray-500 flex items-center">
                  <Mail className="w-3.5 h-3.5 mr-1" />
                  {member.email}
                </p>
                {member.phone && (
                  <p className="text-sm text-gray-500 flex items-center">
                    <Phone className="w-3.5 h-3.5 mr-1" />
                    {member.phone}
                  </p>
                )}
              </div>
            </div>

            {member.id !== currentUser?.id && (
              <button
                onClick={() => handleRemoveMember(member.id)}
                className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite Team Member</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="team@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="technician">Technician</option>
                  <option value="dispatcher">Dispatcher</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowInviteModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleInvite}
                disabled={!inviteEmail || inviting}
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
