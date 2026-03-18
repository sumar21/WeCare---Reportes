import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, Play, ChevronDownIcon, ChefHat } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Combobox } from '@/src/components/ui/combobox';
import { cn } from '@/lib/utils';

// ─── types ───────────────────────────────────────────────────────────────────

interface PlanRecord {
  Fecha_GC?: string;
  Status_GC?: string;
  StatusCena_GC?: string;
  TipoMenu_GC?: string;
  ListaMenu_GC?: string;
  Residente_GC?: string;
  IDResidente_GC?: string;
  MenuAlmuerzo_GC?: string;
  EntradaAlmuerzo_GC?: string;
  PlatoPrincipalAlmuerzo_GC?: string;
  GuarnicionAlmuerzo_GC?: string;
  SalsaAlmuerzo_GC?: string;
  PostreAlmuerzo_GC?: string;
  MenuCena_GC?: string;
  EntradaCena_GC?: string;
  PrincipalCena_GC?: string;
  GuarnicionCena_GC?: string;
  SalsaCena_GC?: string;
  PostreCena_GC?: string;
}

type Curso = 'Entrada' | 'Plato principal' | 'Guarnicion' | 'Salsa' | 'Postre';
const CURSOS: Curso[] = ['Entrada', 'Plato principal', 'Guarnicion', 'Salsa', 'Postre'];

const ALLOWED_STATUS = new Set(['Entregado', 'Preparado', 'Esperando']);

const DIETAS = [
  'TODOS', 'GENERAL', 'GENERAL - Principal', 'DIABETICO',
  'CELIACO', 'BLANDO MECANICO', 'PROCESADO',
] as const;

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseFechaGC(value: string): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dmy) return null;
  const [, d, m, y] = dmy.map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function toISODate(date: Date): string { return format(date, 'yyyy-MM-dd'); }

function fromISODate(value: string): Date | null {
  const parts = String(value || '').trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function getCursoField(plan: PlanRecord, turno: 'Almuerzo' | 'Cena', curso: Curso): string {
  if (turno === 'Almuerzo') {
    switch (curso) {
      case 'Entrada': return String(plan.EntradaAlmuerzo_GC || '').trim();
      case 'Plato principal': return String(plan.PlatoPrincipalAlmuerzo_GC || '').trim();
      case 'Guarnicion': return String(plan.GuarnicionAlmuerzo_GC || '').trim();
      case 'Salsa': return String(plan.SalsaAlmuerzo_GC || '').trim();
      case 'Postre': return String(plan.PostreAlmuerzo_GC || '').trim();
    }
  } else {
    switch (curso) {
      case 'Entrada': return String(plan.EntradaCena_GC || '').trim();
      case 'Plato principal': return String(plan.PrincipalCena_GC || '').trim();
      case 'Guarnicion': return String(plan.GuarnicionCena_GC || '').trim();
      case 'Salsa': return String(plan.SalsaCena_GC || '').trim();
      case 'Postre': return String(plan.PostreCena_GC || '').trim();
    }
  }
  return '';
}

// ─── component ───────────────────────────────────────────────────────────────

export default function ReporteCocina() {
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [planificaciones, setPlanificaciones] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDieta, setSelectedDieta] = useState<string>('TODOS');
  // Fechas "congeladas" del ultimo reporte generado
  const [generatedInicio, setGeneratedInicio] = useState('');
  const [generatedFin, setGeneratedFin] = useState('');

  const fechaInicioDate = fechaInicio ? fromISODate(fechaInicio) : undefined;
  const fechaFinDate = fechaFin ? fromISODate(fechaFin) : undefined;
  const genInicioDate = generatedInicio ? fromISODate(generatedInicio) : undefined;
  const genFinDate = generatedFin ? fromISODate(generatedFin) : undefined;
  const maxDays = 15;
  const rangeOk = fechaInicioDate && fechaFinDate && differenceInDays(fechaFinDate, fechaInicioDate) <= maxDays && fechaFinDate >= fechaInicioDate;

  const handleGenerar = async () => {
    if (!fechaInicio || !fechaFin) return;
    setLoading(true);
    setError(null);
    setPlanificaciones([]);
    try {
      const res = await fetch(`/api/planificaciones?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data: PlanRecord[] = await res.json();
      console.log('[Cocina] planificaciones recibidas:', data.length);
      const dateDist: Record<string, number> = {};
      data.forEach((p) => { const k = String(p.Fecha_GC || 'sin fecha'); dateDist[k] = (dateDist[k] || 0) + 1; });
      console.log('[Cocina] registros por fecha:', dateDist);
      // Detectar dias sin planificaciones
      const datesWithData = new Set<string>();
      data.forEach((p) => { if (p.Fecha_GC) datesWithData.add(String(p.Fecha_GC).trim()); });

      const startD = fromISODate(fechaInicio)!;
      const endD = fromISODate(fechaFin)!;
      const sinDatos: string[] = [];
      let c = new Date(startD);
      while (c <= endD) {
        const ddmmyyyy = format(c, 'dd/MM/yyyy');
        if (!datesWithData.has(ddmmyyyy)) sinDatos.push(format(c, 'dd/MM/yyyy'));
        c = addDays(c, 1);
      }

      if (sinDatos.length > 0) {
        setError(`Sin planificaciones para: ${sinDatos.join(', ')}`);
      }

      setGeneratedInicio(fechaInicio);
      setGeneratedFin(fechaFin);
      setPlanificaciones(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener datos');
    } finally {
      setLoading(false);
    }
  };

  // ─── compute grid ─────────────────────────────────────────────────────────

  const { dates, grid } = useMemo(() => {
    if (!genInicioDate || !genFinDate || planificaciones.length === 0) {
      return { dates: [] as string[], grid: {} as Record<string, Record<string, Record<string, Map<string, number>>>> };
    }

    const dateList: string[] = [];
    let cur = new Date(genInicioDate);
    while (cur <= genFinDate) { dateList.push(format(cur, 'yyyy-MM-dd')); cur = addDays(cur, 1); }

    const gridData: Record<string, Record<string, Record<string, Map<string, number>>>> = {};
    for (const dk of dateList) {
      gridData[dk] = { Almuerzo: {}, Cena: {} };
      for (const c of CURSOS) { gridData[dk].Almuerzo[c] = new Map(); gridData[dk].Cena[c] = new Map(); }
    }

    for (const plan of planificaciones) {
      const fecha = parseFechaGC(plan.Fecha_GC || '');
      if (!fecha || fecha < genInicioDate || fecha > genFinDate) continue;
      const dk = format(fecha, 'yyyy-MM-dd');
      if (!gridData[dk]) continue;

      const tipoMenu = String(plan.TipoMenu_GC || '').trim();
      if (selectedDieta !== 'TODOS') {
        if (selectedDieta === 'GENERAL - Principal') { if (tipoMenu !== 'GENERAL') continue; }
        else { if (tipoMenu !== selectedDieta) continue; }
      }

      // Almuerzo — no filtramos por Status_GC, mostramos todo lo planificado
      for (const curso of CURSOS) {
        const receta = getCursoField(plan, 'Almuerzo', curso);
        if (receta) gridData[dk].Almuerzo[curso].set(receta, (gridData[dk].Almuerzo[curso].get(receta) || 0) + 1);
      }

      // Cena
      for (const curso of CURSOS) {
        const receta = getCursoField(plan, 'Cena', curso);
        if (receta) gridData[dk].Cena[curso].set(receta, (gridData[dk].Cena[curso].get(receta) || 0) + 1);
      }
    }

    return { dates: dateList, grid: gridData };
  }, [planificaciones, genInicioDate, genFinDate, selectedDieta]);

  const isTopOnly = selectedDieta === 'GENERAL - Principal';

  const formatCell = (m: Map<string, number>): string => {
    if (!m || m.size === 0) return '';
    const sorted = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    const items = isTopOnly ? sorted.slice(0, 1) : sorted;
    return items.map(([r, c]) => `${c} - ${r}`).join(' / ');
  };

  const fmtDate = (dk: string) => { const d = fromISODate(dk); return d ? format(d, 'dd/MM/yyyy') : dk; };

  // ─── export excel ─────────────────────────────────────────────────────────

  const handleExportExcel = () => {
    if (dates.length === 0) return;
    const rows: (string | number)[][] = [];
    for (const turno of ['Almuerzo', 'Cena'] as const) {
      rows.push([turno.toUpperCase()]);
      rows.push(['Curso', ...dates.map(fmtDate)]);
      for (const curso of CURSOS) rows.push([curso, ...dates.map((dk) => formatCell(grid[dk]?.[turno]?.[curso]))]);
      rows.push([]);
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colWidths = rows.reduce((w, row) => { row.forEach((c, i) => { w[i] = Math.max(w[i] || 10, Math.min(String(c || '').length + 2, 80)); }); return w; }, [] as number[]);
    ws['!cols'] = colWidths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, `Cocina ${selectedDieta}`.slice(0, 31));
    XLSX.writeFile(wb, `Reporte_Cocina_${fechaInicio}_${fechaFin}_${selectedDieta}.xlsx`);
  };

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm">
            <Loader2 className="h-10 w-10 text-[#549097] animate-spin" />
            <p className="font-semibold text-slate-900">Generando reporte...</p>
            <p className="text-sm text-slate-500 text-center">Obteniendo datos de SharePoint</p>
          </div>
        </div>
      )}

      {/* HEADER with controls inline */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600 border border-slate-200">
              <ChefHat className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Planificacion de Cocina</h1>
          </div>

          {/* Controls — inline with title */}
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Popover>
              <PopoverTrigger render={
                <Button type="button" variant="outline" className={cn('h-9 w-[170px] justify-between border-slate-200 bg-white px-3 text-left font-normal text-sm hover:bg-slate-50', !fechaInicioDate && 'text-muted-foreground')}>
                  {fechaInicioDate ? format(fechaInicioDate, 'dd/MM/yyyy') : 'Desde'}
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>
              } />
              <PopoverContent align="start" sideOffset={6} className="w-auto p-0">
                <Calendar mode="single" selected={fechaInicioDate} defaultMonth={fechaInicioDate} locale={es} initialFocus
                  onSelect={(date) => {
                    if (!date) return;
                    setFechaInicio(toISODate(date));
                    if (fechaFinDate && date > fechaFinDate) setFechaFin(toISODate(date));
                    if (fechaFinDate && differenceInDays(fechaFinDate, date) > maxDays) setFechaFin(toISODate(addDays(date, maxDays)));
                    if (!fechaFin) setFechaFin(toISODate(date));
                  }}
                />
              </PopoverContent>
            </Popover>

            <span className="text-slate-400 text-sm">a</span>

            <Popover>
              <PopoverTrigger render={
                <Button type="button" variant="outline" className={cn('h-9 w-[170px] justify-between border-slate-200 bg-white px-3 text-left font-normal text-sm hover:bg-slate-50', !fechaFinDate && 'text-muted-foreground')}>
                  {fechaFinDate ? format(fechaFinDate, 'dd/MM/yyyy') : 'Hasta'}
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>
              } />
              <PopoverContent align="start" sideOffset={6} className="w-auto p-0">
                <Calendar mode="single" selected={fechaFinDate} defaultMonth={fechaFinDate} locale={es} initialFocus
                  onSelect={(date) => {
                    if (!date) return;
                    if (fechaInicioDate && differenceInDays(date, fechaInicioDate) > maxDays) setFechaFin(toISODate(addDays(fechaInicioDate, maxDays)));
                    else if (fechaInicioDate && date < fechaInicioDate) setFechaFin(toISODate(fechaInicioDate));
                    else setFechaFin(toISODate(date));
                  }}
                />
              </PopoverContent>
            </Popover>

            <Combobox
              value={selectedDieta}
              onChange={setSelectedDieta}
              options={DIETAS.map((d) => ({ label: d, value: d }))}
              placeholder="Dieta"
              searchPlaceholder="Buscar dieta..."
              emptyText="No encontrada."
              className="h-9 w-[200px] text-sm"
            />

            <Button onClick={handleGenerar} disabled={!rangeOk || loading}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm h-9 px-5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Generar
            </Button>

            <Button variant="outline" onClick={handleExportExcel} disabled={dates.length === 0}
              className="h-9 px-3 border-slate-200 hover:bg-slate-50 text-slate-700 shrink-0 shadow-sm">
              <FileSpreadsheet className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-3 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">{error}</div>
        )}
      </div>

      {/* MAIN — full remaining height for the grid */}
      <div className="flex-1 min-h-0 overflow-hidden px-4 py-3">
        <div className="h-full min-h-0 flex flex-col">

          {/* GRID — scrollable horizontally, fixed min-width per date column */}
          {dates.length > 0 && (
            <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              {(['Almuerzo', 'Cena'] as const).map((turno) => (
                <div key={turno}>
                  <div className="sticky left-0 bg-[#ebf8f8] border-b border-[#cfeeed] px-4 py-2 text-sm font-bold text-[#265b59] uppercase tracking-wider">
                    {turno}
                  </div>
                  <table className="text-sm border-collapse" style={{ minWidth: 130 + dates.length * 350 }}>
                    <colgroup>
                      <col style={{ width: 130, minWidth: 130 }} />
                      {dates.map((dk) => <col key={dk} style={{ width: 350, minWidth: 350 }} />)}
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="sticky left-0 z-20 bg-slate-50 px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-r border-slate-200">
                          Curso
                        </th>
                        {dates.map((dk) => (
                          <th key={dk} className="bg-slate-50 px-3 py-2 text-center text-xs font-bold text-[#5fc6c3] border-b border-r border-slate-200 last:border-r-0">
                            {fmtDate(dk)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {CURSOS.map((curso) => (
                        <tr key={curso} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                          <td className="sticky left-0 z-10 bg-white px-4 py-2 font-semibold text-slate-600 border-r border-slate-200 whitespace-nowrap align-top">
                            {curso}
                          </td>
                          {dates.map((dk) => {
                            const text = formatCell(grid[dk]?.[turno]?.[curso]);
                            return (
                              <td key={dk} className="px-3 py-2 text-slate-700 border-r border-slate-200 last:border-r-0 align-top text-[13px] leading-relaxed">
                                {text || <span className="text-slate-300">-</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && planificaciones.length === 0 && !error && (
            <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col items-center justify-center py-16 text-slate-400">
              <ChefHat className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-semibold text-slate-500">Listo para comenzar</p>
              <p className="text-sm">Elegi el rango de fechas y genera el reporte</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
