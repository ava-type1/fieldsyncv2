import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Building2, 
  Bell, 
  CreditCard, 
  Users, 
  LogOut,
  ChevronRight,
  Moon,
  Sun,
  Link2
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';

interface SettingsItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  rightElement?: React.ReactNode;
}

function SettingsItem({ icon, label, description, onClick, rightElement }: SettingsItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
    >
      <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && (
          <p className="text-sm text-gray-500 truncate">{description}</p>
        )}
      </div>
      {rightElement || <ChevronRight className="w-5 h-5 text-gray-400" />}
    </button>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { logout } = useAuth();
  const [darkMode, setDarkMode] = useState(false);

  const handleSignOut = async () => {
    await logout();
    // logout() already navigates to /login
  };

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white mt-4 mx-4 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</p>
        </div>
        
        <SettingsItem
          icon={<User className="w-5 h-5" />}
          label="Profile"
          description={user?.email || 'Manage your profile'}
          onClick={() => navigate('/settings/profile')}
        />
        
        <SettingsItem
          icon={<Building2 className="w-5 h-5" />}
          label="Organization"
          description="Company settings and branding"
          onClick={() => navigate('/settings/organization')}
        />
        
        <SettingsItem
          icon={<Users className="w-5 h-5" />}
          label="Team Members"
          description="Manage users and permissions"
          onClick={() => navigate('/settings/team')}
        />
      </div>

      {/* Preferences Section */}
      <div className="bg-white mt-4 mx-4 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Preferences</p>
        </div>
        
        <SettingsItem
          icon={<Bell className="w-5 h-5" />}
          label="Notifications"
          description="Push, email, and SMS settings"
          onClick={() => navigate('/settings/notifications')}
        />
        
        <SettingsItem
          icon={darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          label="Appearance"
          description={darkMode ? 'Dark mode' : 'Light mode'}
          onClick={() => setDarkMode(!darkMode)}
          rightElement={
            <div className={`w-12 h-7 rounded-full p-1 transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${darkMode ? 'translate-x-5' : ''}`} />
            </div>
          }
        />
      </div>

      {/* Integrations Section */}
      <div className="bg-white mt-4 mx-4 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Integrations</p>
        </div>
        
        <SettingsItem
          icon={<Link2 className="w-5 h-5" />}
          label="QuickBooks"
          description="Sync invoices and customers"
          onClick={() => navigate('/settings/quickbooks')}
        />
      </div>

      {/* Billing Section */}
      <div className="bg-white mt-4 mx-4 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Billing</p>
        </div>
        
        <SettingsItem
          icon={<CreditCard className="w-5 h-5" />}
          label="Subscription"
          description="Free Trial • Upgrade anytime"
          onClick={() => navigate('/settings/billing')}
        />
      </div>

      {/* Sign Out */}
      <div className="mt-6 mx-4 pb-8">
        <Button
          variant="outline"
          className="w-full justify-center text-red-600 border-red-200 hover:bg-red-50"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* Version Info */}
      <div className="text-center pb-8">
        <p className="text-xs text-gray-400">FieldSync v1.0.0</p>
      </div>
    </div>
  );
}
