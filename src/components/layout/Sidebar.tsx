import { useState, type ElementType } from 'react';
import { LogOut, RefreshCw, ShoppingCart, Layers, Menu, X, ChefHat } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { ReportView } from '@/src/App';

interface SidebarProps {
  activeReport: ReportView;
  onNavigate: (report: ReportView) => void;
  onLogout: () => void;
  userName?: string;
}

const navItems: { id: ReportView; icon: ElementType; label: string }[] = [
  { id: 'ingredientes', icon: Layers,       label: 'Ingredientes' },
  { id: 'compras',      icon: ShoppingCart, label: 'Compras / Consumo' },
  { id: 'cocina',       icon: ChefHat,     label: 'Planificación Cocina' },
];

export default function Sidebar({ activeReport, onNavigate, onLogout, userName }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = (id: ReportView) => {
    onNavigate(id);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 p-4 shrink-0 shadow-sm relative z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#5fc6c3] flex items-center justify-center shadow-inner relative overflow-hidden">
            <div className="absolute inset-0 bg-white/20 blur-[2px] rounded-full scale-150 -translate-y-2" />
            <span className="font-bold text-white text-sm relative z-10 drop-shadow-sm">W</span>
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-base leading-tight tracking-tight">WeCare</h1>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="p-2 -mr-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <div className={cn(
        "bg-white border-r border-slate-200 flex flex-col shrink-0 md:w-64 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-transform duration-300 md:h-screen fixed md:static z-50 w-[80%] max-w-[300px] h-full top-0 left-0",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Logo Area (Desktop) */}
        <div className="hidden md:flex p-6 border-b border-slate-100 items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-[#5fc6c3] flex items-center justify-center shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)] relative overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-white/20 blur-[2px] rounded-full scale-150 -translate-y-2" />
            <span className="font-bold text-white text-lg relative z-10 drop-shadow-sm">W</span>
          </div>
          <div className="overflow-hidden">
            <h1 className="font-extrabold text-slate-900 text-[18px] leading-tight tracking-tight">WeCare</h1>
            <p className="text-[10px] text-[#4db6b3] uppercase font-bold tracking-widest mt-0.5">Reportes</p>
          </div>
        </div>

        {/* Mobile Header (inside drawer) */}
        <div className="md:hidden p-5 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[10px] text-[#4db6b3] uppercase font-bold tracking-widest">Menú Principal</p>
          <button onClick={() => setIsOpen(false)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2 pb-3">Métricas Activas</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group",
                activeReport === item.id
                  ? "bg-[#5fc6c3]/10 text-[#265b59]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              <item.icon className={cn(
                "h-5 w-5 shrink-0 transition-colors", 
                activeReport === item.id ? "text-[#5fc6c3]" : "text-slate-400 group-hover:text-slate-600"
              )} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-100 space-y-1 bg-slate-50/50">
          {userName && (
            <div className="px-3 py-3 text-xs text-slate-500 mb-2 bg-white rounded-lg border border-slate-100 shadow-sm flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-[9px] uppercase tracking-wider font-bold text-slate-400 leading-none mb-1">Sesión iniciada</p>
                <p className="font-semibold text-slate-700 truncate min-w-0">{userName}</p>
              </div>
            </div>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-sm transition-all rounded-xl"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar datos
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-all rounded-xl"
          >
             <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </>
  );
}
