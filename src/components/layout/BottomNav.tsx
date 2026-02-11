import { NavLink } from 'react-router-dom';
import { Briefcase, ScanLine, MapPin, DollarSign } from 'lucide-react';

const navItems = [
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/scan', icon: ScanLine, label: 'Scan' },
  { to: '/map', icon: MapPin, label: 'Map' },
  { to: '/pay', icon: DollarSign, label: 'Pay' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800 pb-safe z-10">
      <div className="flex justify-around items-center">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center py-3 px-5 min-w-[64px] transition-all ${
                isActive 
                  ? 'text-blue-400' 
                  : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`relative ${isActive ? '' : ''}`}>
                  <Icon className={`w-6 h-6 ${isActive ? 'drop-shadow-[0_0_6px_rgba(96,165,250,0.5)]' : ''}`} />
                  {isActive && (
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                  )}
                </div>
                <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
