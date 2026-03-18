import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, ShoppingCart, UtensilsCrossed, Loader2, Play, Sparkles, ChevronDownIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';

// ─── helpers de redondeo ─────────────────────────────────────────────────────

function roundUpPositive(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value < 1 ? 1 : Math.ceil(value);
}

function roundKg(grams: number): number {
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  return Math.round((grams / 1000) * 100) / 100;
}

function parseFechaGC(value: string): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function fromISODate(value: string): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parts = raw.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return null;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

// ─── cálculo de cantidades ────────────────────────────────────────────────────

function calcCantidadGr(cantKgIR: number, kgTotal: number, tamanoPorcion: number): number {
  if (tamanoPorcion <= 0 || kgTotal <= 0) return 0;
  // tamanoPorcion está en gramos, kgTotal en KG → porciones = (kgTotal * 1000) / tamanoPorcion
  const porciones = (kgTotal * 1000) / tamanoPorcion;
  if (porciones <= 0 || !Number.isFinite(porciones)) return 0;
  const result = (cantKgIR * 1000) / porciones;
  return Number.isFinite(result) && result > 0 ? result : 0;
}

function calcCantidadGrFactor(
  cantKgIR: number,
  factorCorrectivo: number,
  kgTotal: number,
  tamanoPorcion: number,
): number {
  if (tamanoPorcion <= 0 || kgTotal <= 0) return 0;
  const porciones = (kgTotal * 1000) / tamanoPorcion;
  if (porciones <= 0 || !Number.isFinite(porciones)) return 0;
  const cantAdj = (!factorCorrectivo || factorCorrectivo <= 0) ? cantKgIR : cantKgIR / (factorCorrectivo / 100);
  const result = (cantAdj * 1000) / porciones;
  return Number.isFinite(result) && result > 0 ? result : 0;
}

// ─── tipos internos ───────────────────────────────────────────────────────────

interface ReporteRow {
  ingrediente: string;
  grupo: string;
  subgrupo: string;
  factorCorrectivoIngrediente: number;
  cantidadKg: number;
  cantidadKgFactor: number;
  cantUnidades: string;
  promedioPersona: number;
  listas: string;
  dietas: string;
  unidades: string;
  recetas: string;
}

interface RecetaData {
  id: string;
  nombre: string;
  kgTotal: number;
  tamanoPorcion: number;
}

interface IngredienteData {
  nombre: string;
  grupo: string;
  subgrupo: string;
  gramosUnidad: number;
  factorCorrectivo: number;
  esReceta: boolean;
}

interface IngredienteRecetaData {
  recetaId: string;
  ingredienteId: string;
  cantidadKg: number;
  factorCorrectivo: number;
  unidadMedida: string;
}

// ─── componente ───────────────────────────────────────────────────────────────

export default function ReporteComprasConsumo() {
  // Defaults: rango de la semana actual
  const today = new Date();
  const formatISO = (d: Date) => d.toISOString().split('T')[0];
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);

  const [fechaInicio, setFechaInicio] = useState(formatISO(startOfWeek));
  const [fechaFin, setFechaFin]       = useState(formatISO(today));
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const [planificaciones, setPlanificaciones]             = useState<any[] | null>(null);
  const [recetasData, setRecetasData]                     = useState<RecetaData[]>([]);
  const [ingredientesData, setIngredientesData]           = useState<IngredienteData[]>([]);
  const [ingredientesRecetaData, setIngredientesRecetaData] = useState<IngredienteRecetaData[]>([]);

  const fechaInicioDate = useMemo(() => fromISODate(fechaInicio), [fechaInicio]);
  const fechaFinDate = useMemo(() => fromISODate(fechaFin), [fechaFin]);

  // Tipo auto-determinado: Compras si la fecha inicio es posterior a hoy
  const tipoReporte = useMemo(() => {
    const inicio = new Date(fechaInicio + 'T00:00:00');
    const hoy    = new Date(formatISO(today) + 'T00:00:00');
    return inicio > hoy ? 'Compras' : 'Consumo';
  }, [fechaInicio]);

  const handleGenerarReporte = async () => {
    setPlanificaciones(null);
    setError(null);
    setIsLoading(true);
    try {
      const apiFetch = async (path: string) => {
        const r = await fetch(path);
        if (!r.ok) throw new Error(`API error en ${path}: ${r.statusText}`);
        return r.json();
      };

      const needsStaticData =
        recetasData.length === 0 ||
        ingredientesData.length === 0 ||
        ingredientesRecetaData.length === 0;

      const dataPlan = await apiFetch(`/api/planificaciones?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`);
      console.log('[Compras/Consumo] planificaciones recibidas:', Array.isArray(dataPlan) ? dataPlan.length : 0);

      let dataRecetas: any[] = recetasData;
      let dataIngredientes: any[] = ingredientesData;
      let dataIngReceta: any[] = ingredientesRecetaData;

      if (needsStaticData) {
        [dataRecetas, dataIngredientes, dataIngReceta] = await Promise.all([
          apiFetch('/api/recetas'),
          apiFetch('/api/ingredientes'),
          apiFetch('/api/ingredientes-receta'),
        ]);
        console.log('[Compras/Consumo] static data:', {
          recetas: Array.isArray(dataRecetas) ? dataRecetas.length : 0,
          ingredientes: Array.isArray(dataIngredientes) ? dataIngredientes.length : 0,
          ingredientesReceta: Array.isArray(dataIngReceta) ? dataIngReceta.length : 0,
        });
      }

      setPlanificaciones(dataPlan);

      if (needsStaticData) {
        setRecetasData(dataRecetas.map((item: any) => {
          const kgTotal = Number(String(item.KGTotal_RE || '0').replace(',', '.'));
          const tamRaw = Number(String(item.TamanoPorcion_RE || '1').replace(',', '.'));
          return {
            id:            item.Receta_RE || '',
            nombre:        item.Receta_RE || '',
            kgTotal,
            tamanoPorcion: tamRaw,
          };
        }));

        setIngredientesData(dataIngredientes.map((item: any) => ({
          nombre:        String(item.Ingrediente_IN || item.field_1 || '').trim(),
          grupo:         String(item.Grupo_IN || item.field_2 || ''),
          subgrupo:      String(item.SubGrupo_IN || item.field_3 || ''),
          gramosUnidad:  Number(String(item.GramosUnidad_IN || '0').replace(',', '.')),
          factorCorrectivo: Number(String(item.FactorCorrectivo_IN || item.field_9 || '0').replace(',', '.')),
          esReceta:      ['sí', 'si', 'yes', '1'].includes(String(item.EsReceta_IN || '').trim().toLowerCase()),
        })));

        setIngredientesRecetaData(dataIngReceta.map((item: any) => ({
          recetaId:          (item.Receta_IR  || '').trim(),
          ingredienteId:     (item.Ingrediente || '').trim(),
          cantidadKg:        Number(String(item.CantidadRecetaKG_IR || '0').replace(',', '.')),
          factorCorrectivo:  Number(String(item.FactorCorrectivo_IR  || '0').replace(',', '.')),
          unidadMedida:      (item.UnidadMedida_IR || '').toUpperCase(),
        })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPlanificaciones([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── cálculo del reporte ───────────────────────────────────────────────────

  const reporteData = useMemo<{ rows: ReporteRow[]; detail: Array<{ fecha: string; persona: string; turno: string; receta: string; ingrediente: string; cantidadGR: number; unit: string }> } | null>(() => {
    if (!planificaciones) return null;

    const startDate = new Date(fechaInicio + 'T00:00:00');
    const endDate   = new Date(fechaFin   + 'T00:00:00');
    const ALLOWED_STATUS = new Set(['Pendiente', 'Esperando', 'Entregado']);

    const records = planificaciones.filter((plan) => {
      const fecha = parseFechaGC(plan.Fecha_GC);
      if (!fecha || fecha < startDate || fecha > endDate) return false;
      const planActiva = String(plan.StatusPlanificacion13_GC || 'Activo').trim().toLowerCase() === 'activo';
      const residenteActivo = String(plan.StatusResidente_GC || 'Activo').trim().toLowerCase() === 'activo';
      return planActiva && residenteActivo;
    });

    const normalizeKey = (value: string): string =>
      String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();

    const recetasMap = new Map<string, RecetaData>(recetasData.map((r) => [normalizeKey(r.nombre), r]));
    const ingredMap = new Map<string, IngredienteData>(ingredientesData.map((i) => [normalizeKey(i.nombre), i]));

    // Set de ingredientes que son sub-recetas (EsReceta=true)
    const esRecetaSet = new Set(
      ingredientesData
        .filter((i) => i.esReceta)
        .map((i) => normalizeKey(i.nombre))
    );

    // Whitelist: ingredientes reales (no sub-recetas) que existen en la lista
    const ingredientesPermitidos = new Set(
      ingredientesData
        .filter((i) => !i.esReceta)
        .map((i) => normalizeKey(i.nombre))
    );

    // Mapa completo de ingredientesReceta por receta (para resolución recursiva)
    const allIRByReceta = new Map<string, IngredienteRecetaData[]>();
    ingredientesRecetaData.forEach((ir) => {
      const key = normalizeKey(ir.recetaId);
      if (!allIRByReceta.has(key)) allIRByReceta.set(key, []);
      allIRByReceta.get(key)!.push(ir);
    });

    // Buscar la receta de un sub-ingrediente (con fallbacks de nombre)
    const findSubReceta = (ingKey: string): RecetaData | undefined => {
      if (recetasMap.has(ingKey)) return recetasMap.get(ingKey);
      if (ingKey.startsWith('bloque ')) return recetasMap.get(ingKey.slice(7));
      const sinBloque = ingKey.replace(/\s*\(bloque\)\s*$/, '');
      if (sinBloque !== ingKey) return recetasMap.get(sinBloque);
      return undefined;
    };

    // Detectar si un ingrediente es sub-receta que se puede descomponer
    const isDecomposable = (ingKey: string): boolean => {
      if (!esRecetaSet.has(ingKey) && !ingredientesPermitidos.has(ingKey)) {
        // No está en la lista de ingredientes — verificar si existe como receta
        return !!findSubReceta(ingKey);
      }
      return esRecetaSet.has(ingKey);
    };

    // Resolver ingredientes recursivamente (descomponer sub-recetas en ingredientes reales)
    const resolveIngredients = (
      recetaKey: string,
      scaleFactor: number = 1,
      visited: Set<string> = new Set(),
    ): IngredienteRecetaData[] => {
      if (visited.has(recetaKey)) return [];
      visited.add(recetaKey);

      const irs = allIRByReceta.get(recetaKey) || [];
      const result: IngredienteRecetaData[] = [];

      for (const ir of irs) {
        const ingKey = normalizeKey(ir.ingredienteId);

        if (isDecomposable(ingKey)) {
          const subReceta = findSubReceta(ingKey);
          if (subReceta && subReceta.kgTotal > 0 && ir.cantidadKg > 0) {
            const sf = scaleFactor * ir.cantidadKg / subReceta.kgTotal;
            const subKey = normalizeKey(subReceta.nombre);
            const subIngredients = resolveIngredients(subKey, sf, new Set(visited));
            result.push(...subIngredients.map((si) => ({
              ...si,
              recetaId: ir.recetaId,
            })));
          }
        } else if (ingredientesPermitidos.has(ingKey)) {
          // Solo incluir ingredientes reales que existen en la lista
          result.push({
            ...ir,
            cantidadKg: ir.cantidadKg * scaleFactor,
          });
        }
        // Ingredientes que no están en la lista NI son sub-recetas → se descartan (ej: "ajo")
      }

      return result;
    };

    const normalizeUnit = (unidad: string): string => {
      const u = (unidad || '').toUpperCase();
      if (u === 'CC' || u === 'LT') return 'LT';
      if (u === 'GR' || u === 'KG' || u === 'CN') return 'KG';
      return 'UN';
    };

    type Dish = {
      receta: string;
      recetaKey: string;
      meal: 'A' | 'C';
      tipoMenu: string;
      lista: string;
      diaKey: string;
      persona: string;
      fechaDisplay: string;
    };

    const dishes: Dish[] = [];

    records.forEach((plan) => {
      const fecha = parseFechaGC(plan.Fecha_GC);
      if (!fecha) return;
      const diaKey = format(fecha, 'yyyy-MM-dd');
      const tipoMenu = String(plan.TipoMenu_GC || '').trim();
      const lista = String(plan.ListaMenu_GC || '').trim();
      // Persona: Residente > Acompañante > PersonalExtra
      const residente = String(plan.Residente_GC || '').trim();
      const acompanante = String(plan.Acompanante_GC || '').trim();
      const personalExtra = String(plan.PersonalExtra_GC || '').trim();
      const invitadoAlm = String(plan.InvitadoAlmuerzo_GC || '').trim();
      const invitadoCena = String(plan.InvitadoCena_GC || '').trim();
      let persona = residente;
      if (!persona && acompanante) {
        const tipo = invitadoAlm || invitadoCena ? 'Visita' : 'Cuidador';
        persona = `${acompanante} (${tipo})`;
      }
      if (!persona && personalExtra) {
        persona = `${personalExtra} (Personal)`;
      }
      if (!persona) persona = String(plan.IDResidente_GC || '');
      const fechaDisplay = String(plan.Fecha_GC || '').trim();

      const getRecetasFromMenu = (
        concatenado: string | undefined,
        ...cursos: (string | undefined)[]
      ): string[] => {
        // Unión de campo concatenado + campos individuales, deduplicado
        const seen = new Map<string, string>();
        const add = (src: string | undefined) => {
          String(src || '').split('-').map((r) => r.trim()).filter(Boolean)
            .forEach((r) => { const k = normalizeKey(r); if (!seen.has(k)) seen.set(k, r); });
        };
        add(concatenado);
        cursos.forEach(add);
        return Array.from(seen.values());
      };

      if (ALLOWED_STATUS.has(String(plan.Status_GC || '').trim())) {
        getRecetasFromMenu(
          plan.MenuAlmuerzo_GC,
          plan.EntradaAlmuerzo_GC,
          plan.PlatoPrincipalAlmuerzo_GC,
          plan.GuarnicionAlmuerzo_GC,
          plan.SalsaAlmuerzo_GC,
          plan.PostreAlmuerzo_GC,
        ).forEach((receta) => {
          dishes.push({ receta, recetaKey: normalizeKey(receta), meal: 'A', tipoMenu, lista, diaKey, persona, fechaDisplay });
        });
      }

      if (ALLOWED_STATUS.has(String(plan.StatusCena_GC || '').trim())) {
        getRecetasFromMenu(
          plan.MenuCena_GC,
          plan.EntradaCena_GC,
          plan.PrincipalCena_GC,
          plan.GuarnicionCena_GC,
          plan.SalsaCena_GC,
          plan.PostreCena_GC,
        ).forEach((receta) => {
          dishes.push({ receta, recetaKey: normalizeKey(receta), meal: 'C', tipoMenu, lista, diaKey, persona, fechaDisplay });
        });
      }
    });


    const recetasEnPlatos = new Set(dishes.map((d) => d.recetaKey));
    // Resolver sub-recetas recursivamente para cada receta del menú
    const irByReceta = new Map<string, IngredienteRecetaData[]>();
    recetasEnPlatos.forEach((recetaKey) => {
      const resolved = resolveIngredients(recetaKey);
      if (resolved.length > 0) irByReceta.set(recetaKey, resolved);
    });


    type Detail = {
      ingrediente: string;
      receta: string;
      dieta: string;
      lista: string;
      unit: string;
      cantidadGR: number;
      cantidadGRFactor: number;
      persona: string;
      fecha: string;
      turno: string;
    };
    const detail: Detail[] = [];

    dishes.forEach((dish) => {
      const receta = recetasMap.get(dish.recetaKey);
      if (!receta) return;
      const irs = irByReceta.get(dish.recetaKey) || [];

      irs.forEach((ir) => {
        const gramsPerPortion = calcCantidadGr(ir.cantidadKg, receta.kgTotal, receta.tamanoPorcion);
        const gramsPerPortionWithFactor = calcCantidadGrFactor(ir.cantidadKg, ir.factorCorrectivo, receta.kgTotal, receta.tamanoPorcion);

        // Siempre registrar receta/dieta (incluso con 0 gr) para que aparezcan en el reporte
        detail.push({
          ingrediente: ir.ingredienteId,
          receta: dish.receta,
          dieta: dish.tipoMenu,
          lista: dish.lista,
          unit: normalizeUnit(ir.unidadMedida),
          cantidadGR: gramsPerPortion > 0 ? gramsPerPortion : 0,
          cantidadGRFactor: gramsPerPortionWithFactor > 0 ? gramsPerPortionWithFactor : 0,
          persona: dish.persona,
          fecha: dish.fechaDisplay,
          turno: dish.meal === 'A' ? 'Almuerzo' : 'Cena',
        });
      });
    });

    let lunchPersonDays = 0;
    let dinnerPersonDays = 0;
    const distinctDays = new Set<string>();

    records.forEach((plan) => {
      const fecha = parseFechaGC(plan.Fecha_GC);
      if (!fecha) return;
      distinctDays.add(format(fecha, 'yyyy-MM-dd'));
      // Cada registro en gestionComidas corresponde a un residente — contamos directamente
      if (ALLOWED_STATUS.has(String(plan.Status_GC || '').trim())) lunchPersonDays++;
      if (ALLOWED_STATUS.has(String(plan.StatusCena_GC || '').trim())) dinnerPersonDays++;
    });

    const promedioPersona = Math.round(((lunchPersonDays + dinnerPersonDays) / 2 / Math.max(distinctDays.size, 1)) * 100) / 100;

    type Acc = {
      sumGr: number;
      sumGrFactor: number;
      listas: Set<string>;
      dietas: Set<string>;
      unidades: Set<string>;
      recetas: Set<string>;
    };
    const acc = new Map<string, Acc>();

    detail.forEach((d) => {
      const key = d.ingrediente.toLowerCase();
      if (!acc.has(key)) {
        acc.set(key, {
          sumGr: 0,
          sumGrFactor: 0,
          listas: new Set(),
          dietas: new Set(),
          unidades: new Set(),
          recetas: new Set(),
        });
      }
      const a = acc.get(key)!;
      a.sumGr += d.cantidadGR;
      a.sumGrFactor += d.cantidadGRFactor;
      if (d.lista) a.listas.add(d.lista);
      if (d.dieta) a.dietas.add(d.dieta);
      if (d.unit) a.unidades.add(d.unit);
      if (d.receta) a.recetas.add(d.receta);
    });

    const rows = Array.from(acc.entries())
      .filter(([, a]) => a.sumGr > 0)
      .map(([ingKey, a]) => {
        const ing = ingredMap.get(ingKey);
        const gramosU = ing?.gramosUnidad ?? 0;
        return {
          ingrediente: ing?.nombre ?? ingKey,
          grupo: ing?.grupo ?? '',
          subgrupo: ing?.subgrupo ?? '',
          factorCorrectivoIngrediente: ing?.factorCorrectivo ?? 0,
          cantidadKg: roundKg(a.sumGr),
          cantidadKgFactor: roundKg(a.sumGrFactor),
          cantUnidades: gramosU > 0 ? String(roundUpPositive(a.sumGr / gramosU)) : '-',
          promedioPersona,
          listas: Array.from(a.listas).filter(Boolean).sort((x, y) => Number(x) - Number(y)).join(' | '),
          dietas: Array.from(a.dietas).sort((x, y) => x.localeCompare(y, 'es')).join(' - '),
          unidades: Array.from(a.unidades).sort((x, y) => x.localeCompare(y, 'es')).join(' - '),
          recetas: Array.from(a.recetas).sort((x, y) => x.localeCompare(y, 'es')).join(' - '),
        };
      })
      .sort((a, b) => a.ingrediente.localeCompare(b.ingrediente, 'es'));

    // Detalle por persona para la segunda hoja del Excel
    const detailForExport = detail
      .filter((d) => d.cantidadGR > 0)
      .map((d) => ({
        fecha: d.fecha,
        persona: d.persona,
        turno: d.turno,
        receta: d.receta,
        ingrediente: d.ingrediente,
        cantidadGR: Math.round(d.cantidadGR * 100) / 100,
        unit: d.unit,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.persona.localeCompare(b.persona, 'es') || a.turno.localeCompare(b.turno) || a.receta.localeCompare(b.receta, 'es'));

    return { rows, detail: detailForExport };
  }, [planificaciones, recetasData, ingredientesData, ingredientesRecetaData, fechaInicio, fechaFin]);

  const reporte = reporteData?.rows ?? null;

  // ─── exportación Excel ─────────────────────────────────────────────────────

  const handleExportarExcel = () => {
    if (!reporte || reporte.length === 0) return;

    const rows = reporte.map(row => ({
      Ingrediente: row.ingrediente,
      Grupo: row.grupo,
      Subgrupo: row.subgrupo,
      'Factor Correctivo Ingrediente': row.factorCorrectivoIngrediente,
      'Cantidad (KG / LT)': row.cantidadKg,
      'Cantidad (Con Factor Correctivo)': row.cantidadKgFactor,
      'Cantidad (Unidades)': row.cantUnidades,
      'Promedio de Personas': row.promedioPersona,
      Listas: row.listas,
      Recetas: row.recetas,
      Dietas: row.dietas,
      Unidades: row.unidades,
    }));

    const worksheet  = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 32 }, { wch: 24 }, { wch: 22 },
      { wch: 14 }, { wch: 18 }, { wch: 26 },
      { wch: 16 }, { wch: 18 }, { wch: 24 },
      { wch: 70 }, { wch: 50 }, { wch: 16 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tipoReporte);

    // Segunda hoja: detalle por persona
    const detailRows = (reporteData?.detail ?? []).map(d => ({
      Fecha: d.fecha,
      Persona: d.persona,
      Turno: d.turno,
      Receta: d.receta,
      Ingrediente: d.ingrediente,
      'Cantidad (gr)': d.cantidadGR,
      Unidad: d.unit,
    }));
    if (detailRows.length > 0) {
      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      wsDetail['!cols'] = [
        { wch: 14 }, { wch: 28 }, { wch: 12 },
        { wch: 36 }, { wch: 28 }, { wch: 16 }, { wch: 8 },
      ];
      XLSX.utils.book_append_sheet(workbook, wsDetail, 'Detalle');
    }

    XLSX.writeFile(workbook, `Reporte_${tipoReporte}_${fechaInicio}_${fechaFin}.xlsx`);
  };

  // ─── render ────────────────────────────────────────────────────────────────

  const TipoIcon = tipoReporte === 'Compras' ? ShoppingCart : UtensilsCrossed;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm">
            <Loader2 className="h-10 w-10 text-[#549097] animate-spin" />
            <p className="font-semibold text-slate-900">Generando reporte...</p>
            <p className="text-sm text-slate-500 text-center">Obteniendo datos de SharePoint</p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600 border border-slate-200">
                <TipoIcon className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Reporte — {tipoReporte}
              </h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                tipoReporte === 'Compras'
                  ? 'bg-[#ebf8f8] text-[#4db6b3] border-[#a3dedd]'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {tipoReporte === 'Compras' ? 'Fecha futura' : 'Fecha pasada / actual'}
              </span>
            </div>
            <p className="text-slate-500 text-sm">
              Consumo de ingredientes por período. Agrupado por ingrediente con listas y dietas asociadas.
            </p>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 min-h-0 overflow-hidden px-6 py-5">
        <div className="h-full min-h-0 flex flex-col gap-4">

          {/* FILTERS CARD */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">

              {/* Fecha inicio */}
              <div className="space-y-1.5 md:col-span-3">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Fecha inicio
                </label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        data-empty={!fechaInicioDate}
                        className={cn(
                          'h-10 w-full justify-between border-slate-200 bg-white px-3 text-left font-normal text-sm hover:bg-slate-50',
                          !fechaInicioDate && 'text-muted-foreground'
                        )}
                      >
                        {fechaInicioDate ? format(fechaInicioDate, 'PPP', { locale: es }) : <span>Elegir fecha</span>}
                        <ChevronDownIcon className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <PopoverContent align="start" sideOffset={6} className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={fechaInicioDate ?? undefined}
                      defaultMonth={fechaInicioDate ?? undefined}
                      locale={es}
                      initialFocus
                      onSelect={(date) => {
                        if (!date) return;
                        const nextInicio = toISODate(date);
                        setFechaInicio(nextInicio);
                        if (fechaFinDate && date > fechaFinDate) {
                          setFechaFin(nextInicio);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Fecha fin */}
              <div className="space-y-1.5 md:col-span-3">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Fecha fin
                </label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        data-empty={!fechaFinDate}
                        className={cn(
                          'h-10 w-full justify-between border-slate-200 bg-white px-3 text-left font-normal text-sm hover:bg-slate-50',
                          !fechaFinDate && 'text-muted-foreground'
                        )}
                      >
                        {fechaFinDate ? format(fechaFinDate, 'PPP', { locale: es }) : <span>Elegir fecha</span>}
                        <ChevronDownIcon className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <PopoverContent align="start" sideOffset={6} className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={fechaFinDate ?? undefined}
                      defaultMonth={fechaFinDate ?? undefined}
                      locale={es}
                      initialFocus
                      onSelect={(date) => {
                        if (!date) return;
                        const nextFin = toISODate(date);
                        setFechaFin(nextFin);
                        if (fechaInicioDate && date < fechaInicioDate) {
                          setFechaInicio(nextFin);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Tipo auto */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Tipo
                </label>
                <div className={`h-10 w-full rounded-md border px-3 flex items-center text-sm font-semibold ${
                  tipoReporte === 'Compras'
                    ? 'bg-[#ebf8f8] border-[#a3dedd] text-[#317674]'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  <TipoIcon className="h-4 w-4 mr-2 shrink-0" />
                  {tipoReporte}
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-end gap-3 md:col-span-4">
                <Button
                  onClick={handleGenerarReporte}
                  disabled={isLoading}
                  className="flex-1 min-w-0 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm h-10"
                >
                  {isLoading
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <Play     className="h-4 w-4 mr-2" />}
                  Generar Reporte
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportarExcel}
                  disabled={!reporte || reporte.length === 0}
                  className="h-10 px-4 border-slate-200 hover:bg-slate-50 text-slate-700 shrink-0 shadow-sm"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-3 pt-3 border-t border-red-100 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Stats */}
            {reporte && reporte.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-3 mt-3 border-t border-slate-200">
                <div className="bg-[#ebf8f8]/80 rounded-lg p-2 border border-[#cfeeed]">
                  <p className="text-xs text-[#5fc6c3] font-medium uppercase">Ingredientes</p>
                  <p className="text-lg leading-tight font-bold text-[#265b59]">{reporte.length}</p>
                </div>
                <div className="bg-green-50/80 rounded-lg p-2 border border-green-100">
                  <p className="text-xs text-green-600 font-medium uppercase">Total KG</p>
                  <p className="text-lg leading-tight font-bold text-green-900">
                    {reporte.reduce((s: number, r: ReporteRow) => s + r.cantidadKg, 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-sky-50/80 rounded-lg p-2 border border-sky-100">
                  <p className="text-xs text-sky-700 font-medium uppercase">Con factor</p>
                  <p className="text-lg leading-tight font-bold text-sky-900">
                    {reporte.reduce((s: number, r: ReporteRow) => s + r.cantidadKgFactor, 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-amber-50/80 rounded-lg p-2 border border-amber-100">
                  <p className="text-xs text-orange-600 font-medium uppercase">Días</p>
                  <p className="text-lg leading-tight font-bold text-orange-900">
                    {Math.round((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / 86400000) + 1}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* TABLE CARD */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex-1 min-h-0">
            <div className="h-full min-h-0 overflow-x-auto">
              <div className="h-full min-w-max overflow-y-auto">
                <Table className="w-full text-xs">
                  <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <TableRow className="hover:bg-transparent border-b border-slate-200">
                      <TableHead className="w-[240px] text-slate-700 font-semibold text-xs tracking-wide py-3 px-4">
                        Ingrediente
                      </TableHead>
                      <TableHead className="text-right text-slate-700 font-semibold text-xs tracking-wide py-3 px-4 border-l border-slate-200">
                        Cantidad KG
                      </TableHead>
                      <TableHead className="text-right text-slate-700 font-semibold text-xs tracking-wide py-3 px-4 border-l border-slate-200">
                        Cant. U.
                      </TableHead>
                      <TableHead className="text-left text-slate-700 font-semibold text-xs tracking-wide py-3 px-4 border-l border-slate-200 w-[180px]">
                        Listas
                      </TableHead>
                      <TableHead className="text-left text-slate-700 font-semibold text-xs tracking-wide py-3 px-4 border-l border-slate-200">
                        Dietas
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {!planificaciones ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-44">
                          <div className="flex flex-col items-center justify-center gap-2 py-8">
                            <div className="bg-slate-50 rounded-full p-3 border border-slate-100">
                              <Sparkles className="h-6 w-6 text-slate-400" />
                            </div>
                            <div className="text-center mt-2">
                              <p className="text-sm font-medium text-slate-700">Listo para comenzar</p>
                              <p className="text-xs text-slate-500 mt-1">Elegí el rango de fechas y generá el reporte</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : reporte && reporte.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-44">
                          <div className="flex flex-col items-center justify-center gap-2 py-8">
                            <TipoIcon className="h-8 w-8 text-slate-300" />
                            <div className="text-center mt-2">
                              <p className="text-sm font-medium text-slate-700">Sin resultados</p>
                              <p className="text-xs text-slate-500 mt-1">No hay datos para el período seleccionado</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      reporte?.map((row, idx) => (
                        <TableRow
                          key={row.ingrediente}
                          className={`hover:bg-slate-100/50 transition-colors border-b border-slate-100 group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                        >
                          <TableCell className={`font-medium text-slate-800 px-4 py-2.5 sticky left-0 z-20 shadow-[1px_0_0_0_rgba(226,232,240,1)] ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'} group-hover:bg-slate-100`}>
                            {row.ingrediente}
                          </TableCell>
                          <TableCell className="text-right text-slate-700 font-medium px-4 py-2.5 border-l border-slate-100 tabular-nums">
                            {row.cantidadKg.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className={`text-right px-4 py-2.5 border-l border-slate-100 tabular-nums ${row.cantUnidades === '-' ? 'text-slate-300' : 'text-slate-700 font-medium'}`}>
                            {row.cantUnidades}
                          </TableCell>
                          <TableCell className="text-left text-slate-600 px-4 py-2.5 border-l border-slate-100 whitespace-nowrap">
                            {row.listas || <span className="text-slate-300">—</span>}
                          </TableCell>
                          <TableCell className="text-left text-slate-600 px-4 py-2.5 border-l border-slate-100">
                            {row.dietas || <span className="text-slate-300">—</span>}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
