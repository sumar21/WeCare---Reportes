/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FormEvent, useEffect, useState } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import ReporteIngredientes from './features/metricas/ReporteIngredientes';
import ReporteComprasConsumo from './features/metricas/ReporteComprasConsumo';
import ReporteCocina from './features/metricas/ReporteCocina';

export type ReportView = 'ingredientes' | 'compras' | 'cocina';

interface AuthUser {
  concatlog: string;
  nombre: string;
}

export default function App() {
  const [activeReport, setActiveReport] = useState<ReportView>('ingredientes');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [concatlog, setConcatlog] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const parseApiResponse = async (response: Response) => {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    const raw = await response.text();
    if (!raw.trim()) return {};

    try {
      return JSON.parse(raw);
    } catch {
      return { error: raw };
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) return;
        const data = await parseApiResponse(response);
        if (data?.user) setAuthUser(data.user);
      } catch {
        // ignore
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concatlog, password }),
      });

      const data = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo iniciar sesión');
      }

      setAuthUser(data.user);
      setPassword('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Error al iniciar sesión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthUser(null);
      setConcatlog('');
      setPassword('');
      setAuthError(null);
      setActiveReport('ingredientes');
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Verificando sesión...
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen w-full flex flex-col md:flex-row bg-slate-50 font-sans overflow-x-hidden md:overflow-hidden">
        
        {/* Left / Top Panel - dynamic height on mobile */}
        <div className="relative w-full md:w-[45%] lg:w-[40%] flex flex-col justify-center px-7 sm:px-12 md:px-16 pt-12 pb-20 md:py-12 shrink-0 md:min-h-screen z-0">
          
          {/* Background Base wrapper for correct rounding */}
          <div className="absolute inset-0 bg-[#5fc6c3] rounded-b-[2rem] md:rounded-none overflow-hidden z-[-1] shadow-md">
            <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-[#40a09e]/30 blur-2xl pointer-events-none" />
          </div>

          <div className="flex items-center gap-3 mb-6 md:mb-10 mt-safe md:mt-0">
            <div className="w-9 h-9 md:w-11 md:h-11 rounded-[10px] bg-white/20 backdrop-blur-md border border-white/30 shadow-sm flex items-center justify-center">
              <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-sm border-2 border-white" />
            </div>
            <span className="font-bold tracking-[0.2em] text-white/95 uppercase text-[10px] md:text-xs">WeCare</span>
          </div>
          
          <h1 className="text-[2.5rem] leading-[1.1] sm:text-5xl md:text-6xl lg:text-[4rem] font-extrabold tracking-tight text-white drop-shadow-sm max-w-[300px] md:max-w-none">
            Gestión<br />Inteligente
          </h1>
          <p className="text-white/80 text-base md:text-lg lg:text-xl mt-5 max-w-sm font-medium leading-relaxed hidden md:block">
            Accedé a las métricas del sistema, control de consumos e inventario general de manera unificada.
          </p>
        </div>

        {/* Right / Bottom Panel - Form Section */}
        <div className="flex-1 w-full md:w-[55%] lg:w-[60%] flex flex-col justify-start md:justify-center items-center px-4 sm:px-8 pb-12 -mt-10 md:mt-0 z-10 relative">
          <div className="w-full max-w-[400px] lg:max-w-[440px]">
            <div className="bg-white rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-7 sm:p-10 border border-slate-100/80">
                <div className="mb-8">
                  <h2 className="text-2xl md:text-[28px] font-extrabold text-slate-800 tracking-tight">Bienvenido</h2>
                  <p className="text-slate-500 text-[15px] mt-2 font-medium">Ingresá tus credenciales para continuar</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[12px] font-bold text-slate-600 uppercase tracking-wider">Usuario</label>
                    <input
                      value={concatlog}
                      onChange={(e) => setConcatlog(e.target.value)}
                      className="w-full h-[52px] px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5fc6c3]/40 focus:border-[#5fc6c3] focus:bg-white transition-all duration-200 font-medium text-[15px]"
                      placeholder="Ej. Admin"
                      autoComplete="username"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-bold text-slate-600 uppercase tracking-wider">Contraseña</label>
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-[52px] px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5fc6c3]/40 focus:border-[#5fc6c3] focus:bg-white transition-all duration-200 font-medium text-[15px]"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                    />
                  </div>

                  {authError && (
                    <div className="p-4 bg-red-50 text-red-600 text-sm font-semibold rounded-xl border border-red-100/50 flex gap-3 animate-in fade-in zoom-in-95 duration-200">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />
                      <p className="leading-snug">{authError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-[52px] mt-4 rounded-xl bg-[#5fc6c3] text-white text-[15px] font-bold tracking-wide hover:bg-[#4db6b3] hover:shadow-lg hover:shadow-[#5fc6c3]/25 active:scale-[0.98] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Ingresar al sistema
                        <span className="transition-transform duration-200 group-hover:translate-x-1 font-normal opacity-80">→</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-50 overflow-hidden font-sans">
      <Sidebar
        activeReport={activeReport}
        onNavigate={setActiveReport}
        onLogout={handleLogout}
        userName={authUser.nombre || authUser.concatlog}
      />
      <main className="flex-1 w-full min-w-0 overflow-y-auto overflow-x-hidden md:h-screen bg-[#f8fafc]">
        {activeReport === 'ingredientes' ? <ReporteIngredientes /> : activeReport === 'compras' ? <ReporteComprasConsumo /> : <ReporteCocina />}
      </main>
    </div>
  );
}
