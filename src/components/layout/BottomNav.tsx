import { NavLink } from 'react-router-dom';
import { Home, MapPin, Package, LayoutDashboard, Settings } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export function BottomNav() {
  const isManager = useAuthStore((state) => state.isManager());

  const navItems = [
    { to: '/properties', icon: Home, label: 'Properties' },
    { to: '/map', icon: MapPin, label: 'Map' },
    { to: '/materials', icon: Package, label: 'Materials' },
  ];

  if (isManager) {
    navItems.push({ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' });
  }
  
  // Always add settings at the end
  navItems.push({ to: '/settings', icon: Settings, label: 'Settings' });

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t pb-safe z-10">
      <div className="flex justify-around">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center py-3 px-4 min-w-[64px] transition-colors ${
                isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-900'
              }`
            }
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs mt-1">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
