import { Home, Users, Calendar, ChefHat, UtensilsCrossed, BarChart3, Settings, RefreshCw, LogOut } from 'lucide-react';
import { cn } from '@/src/lib/utils';

const navItems = [
  { icon: BarChart3, label: 'Métricas', active: true },
];

export default function Sidebar() {
  return (
    <div className="w-52 bg-white border-r border-slate-200 flex flex-col h-screen shrink-0">
      {/* Logo Area */}
      <div className="p-4 flex justify-center mb-4">
        <div className="flex items-center gap-2 text-[#549097] font-bold text-xl">
          <div className="w-8 h-8 rounded-full border-2 border-[#549097] flex items-center justify-center">
            <span className="italic text-sm">We</span>
          </div>
          <span className="italic">Care</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              item.active 
                ? "bg-[#549097]/10 text-[#549097]" 
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-50">
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
