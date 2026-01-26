import { NavLink } from 'react-router-dom';
import { Home, MapPin, DollarSign, LayoutDashboard, Settings, ScanLine } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

export function BottomNav() {
  const isManager = useAuthStore((state) => state.isManager());

  const leftItems = [
    { to: '/properties', icon: Home, label: 'Properties' },
    { to: '/map', icon: MapPin, label: 'Map' },
  ];

  const rightItems = [
    { to: '/pay', icon: DollarSign, label: 'Pay' },
  ];

  if (isManager) {
    rightItems.push({ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' });
  }
  
  // Always add settings at the end
  rightItems.push({ to: '/settings', icon: Settings, label: 'Settings' });

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t pb-safe z-10">
      <div className="flex justify-around items-end">
        {/* Left items */}
        {leftItems.map(({ to, icon: Icon, label }) => (
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

        {/* Center Quick Start button - elevated */}
        <NavLink
          to="/quick-start"
          className={({ isActive }) =>
            `flex flex-col items-center -mt-4 transition-transform active:scale-95 ${
              isActive ? 'scale-105' : ''
            }`
          }
        >
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
            <ScanLine className="w-7 h-7 text-white" />
          </div>
          <span className="text-xs mt-1 text-gray-600 font-medium">Scan</span>
        </NavLink>

        {/* Right items */}
        {rightItems.map(({ to, icon: Icon, label }) => (
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
