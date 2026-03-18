import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, BarChart3, Loader2, Play, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { ReporteItem } from '@/src/types';

export default function ReporteIngredientes() {
  const [estacion, setEstacion] = useState('Otoño / Invierno');
  const [dieta, setDieta] = useState('GENERAL');
  const [isLoading, setIsLoading] = useState(false);
  const [estacionesOptions, setEstacionesOptions] = useState<Array<{ label: string; value: string }>>([
    { label: 'Otoño / Invierno', value: 'Otoño / Invierno' },
    { label: 'Primavera / Verano', value: 'Primavera / Verano' },
  ]);
  const [dietasOptions, setDietasOptions] = useState<Array<{ label: string; value: string }>>([
    { label: 'General', value: 'GENERAL' },
    { label: 'Diabético', value: 'DIABETICO' },
    { label: 'Adecuado Gástrico', value: 'ADECUADO GASTRICO' },
    { label: 'Celíaco', value: 'CELIACO' },
    { label: 'Blando Mecánico', value: 'BLANDO MECANICO' },
    { label: 'Procesado', value: 'PROCESADO' },
    { label: 'Líquida', value: 'LIQUIDA' },
    { label: 'Nada por Boca', value: 'NADA POR BOCA' },
  ]);
  
  const [menusData, setMenusData] = useState<any[] | null>(null);
  const [recetasData, setRecetasData] = useState<any[]>([]);
  const [ingredientesData, setIngredientesData] = useState<any[]>([]);
  const [ingredientesRecetaData, setIngredientesRecetaData] = useState<any[]>([]);

  const roundUpPositive = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value < 1 ? 1 : Math.ceil(value);
  };

  const toKgDisplay = (gramos: number) => roundUpPositive(gramos / 1000);

useEffect(() => {
    const toLabel = (value: string) =>
      value
        .toLocaleLowerCase('es')
        .replace(/\b\p{L}/gu, (char) => char.toLocaleUpperCase('es'));

    const loadMenuOptions = async () => {
      try {
        const response = await fetch('/api/menus?mode=options');
        if (!response.ok) throw new Error(`API error: ${response.statusText}`);

        const data = await response.json() as
          | { estaciones?: string[]; dietas?: string[] }
          | Array<{ Estacion_MP?: string; Tipo_MP?: string }>;

        const legacyRows = Array.isArray(data) ? data : [];
        const estaciones = Array.isArray(data)
          ? Array.from(
              new Set(
                legacyRows
                  .map((row) => String(row.Estacion_MP ?? '').trim())
                  .filter(Boolean)
              )
            )
          : Array.isArray(data.estaciones)
            ? data.estaciones.filter(Boolean)
            : [];

        const dietas = Array.isArray(data)
          ? Array.from(
              new Set(
                legacyRows
                  .map((row) => String(row.Tipo_MP ?? '').trim())
                  .filter(Boolean)
              )
            )
          : Array.isArray(data.dietas)
            ? data.dietas.filter(Boolean)
            : [];

        if (estaciones.length > 0) {
          const mappedEstaciones = estaciones.map((value) => ({ label: value, value }));
          setEstacionesOptions(mappedEstaciones);

          if (!estaciones.includes(estacion)) {
            setEstacion(estaciones[0]);
          }
        }

        if (dietas.length > 0) {
          const mappedDietas = dietas.map((value) => ({ label: toLabel(value), value }));
          setDietasOptions(mappedDietas);

          if (!dietas.includes(dieta)) {
            setDieta(dietas[0]);
          }
        }
      } catch (error) {
        console.error('No se pudieron cargar opciones de ABM Menu Planificado:', error);
      }
    };

    loadMenuOptions();
  }, []);

  const handleGenerarReporte = async () => {
    // 1. Limpiar reporte antes de empezar
    setMenusData(null); 
    setIsLoading(true);
    
    try {
      const apiFetch = async (path: string) => {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        return await response.json();
      };

      // Ejecutamos las 4 peticiones en paralelo a Graph API
      const [dataMenus, dataRecetas, dataIngredientes, dataIngReceta] = await Promise.all([
        apiFetch(`/api/menus?estacion=${encodeURIComponent(estacion)}&dieta=${encodeURIComponent(dieta)}`),
        apiFetch('/api/recetas'),
        apiFetch('/api/ingredientes'),
        apiFetch('/api/ingredientes-receta'),
      ]);

      setMenusData(dataMenus.map((item: any) => ({
        id: String(item.ID || ''),
        dia: item.Title || '',
        lista: String(item.Lista_MP || ''),
        tipo: item.Tipo_MP || '',
        estacion: item.Estacion_MP || '',
        almuerzo: item.Almuerzo_MP || '',
        cena: item.Cena_MP || ''
      })));

      setRecetasData(dataRecetas.map((item: any) => ({
        id: item.Receta_RE || '',
        nombre: item.Receta_RE || '',
        kgTotal: Number(String(item.KGTotal_RE || '0').replace(',', '.')),
        tamanoPorcion: Number(item.TamanoPorcion_RE || 1)
      })));

      setIngredientesData(dataIngredientes.map((item: any) => ({
        id: item.field_1 || '',
        nombre: item.field_1 || '',
        grupo: item.field_2 || '',
        subgrupo: item.field_3 || '',
        carbs: Number(item.field_6 || 0),
        proteinas: Number(item.field_7 || 0),
        grasas: Number(item.field_8 || 0),
        unidad: item.UnidadMedida_IN || 'kg',
        equivalenteGramos: Number(item.GramosUnidad_IN || 0),
        factorCorrectivo: Number(item.field_9 || 0),
        precioUnidad: Number(item.field_11 || 0),
        medidaGramos: Number(item.field_5 || 0),
        unidadVenta: item.field_10 || '',
        calorias: Number(item.field_12 || 0),
        esReceta: item.EsReceta_IN === 'Sí',
        fechaCreacion: item.Created,
        ultimaModificacion: item.Modified,
        estado: item.field_13 || ''
      })));

      setIngredientesRecetaData(dataIngReceta.map((item: any) => ({
        id: String(item.ID || ''),
        recetaId: item.Receta_IR || '',
        ingredienteId: item.Ingrediente || '',
        cantidadKg: Number(String(item.CantidadRecetaKG_IR || '0').replace(',', '.'))
      })));

    } catch (error) {
      console.error('Error al generar el reporte:', error);
      if (error instanceof Error) {
        try {
          const details = JSON.parse(error.message);
          console.error('Detalles del error:', details);
        } catch (e) {
          console.error('No se pudieron parsear los detalles del error.');
        }
      }
      setMenusData([]); // Asegurar que no quede en null si falla
    } finally {
      setIsLoading(false);
    }
  };

  // LÓGICA TRADUCIDA DE POWERAPPS A JAVASCRIPT OPTIMIZADO
  const { reporte, listasUnicas } = useMemo(() => {
    if (!menusData) return { reporte: null, listasUnicas: [] };

    // 1. Filtrar Menús
    const menusFiltrados = menusData.filter(m => m.estacion === estacion && m.tipo === dieta);
    
    // ... (rest of the logic remains the same)
    // ...


    // 2. Obtener listas únicas
    const listasSet = new Set<string>();
    menusFiltrados.forEach(menu => {
      const lista = menu.lista;
      if (lista !== "0" && lista !== "001" && lista !== "99999999" && lista !== "999999999") {
        listasSet.add(lista);
      }
    });
    const listasOrdenadas = Array.from(listasSet).sort((a, b) => Number(a) - Number(b));

    // 3. Inicializar mapa — clave en minúsculas para lookup consistente
    const ingredientesMap = new Map<string, ReporteItem>();
    ingredientesData.forEach(ing => {
      const item: ReporteItem = {
        ingredienteNombre: ing.nombre,
        cantidadesPorLista: {},
        total: 0,
        promedio: 0
      };
      listasOrdenadas.forEach(lista => {
        item.cantidadesPorLista[lista] = { A: 0, C: 0 };
      });
      ingredientesMap.set(ing.nombre.trim().toLowerCase(), item);
    });

    // 4. Iterar sobre menús y actualizar
    menusFiltrados.forEach(menu => {
      const lista = menu.lista;
      if (!listasSet.has(lista)) return;

      const procesarPlatos = (platosStr: string, tipoPlato: 'A' | 'C') => {
        if (!platosStr) return;
        const recetasIds = platosStr.split('-').map((r: string) => r.trim()).filter(Boolean);

        recetasIds.forEach(recetaId => {
          const recetaIdLower = recetaId.toLowerCase();

          const receta = recetasData.find(r => r.nombre.trim().toLowerCase() === recetaIdLower);
          if (!receta) return;

          const divisor = receta.kgTotal / receta.tamanoPorcion;
          if (divisor <= 0 || !Number.isFinite(divisor)) return;

          const ingredientesDeReceta = ingredientesRecetaData.filter(
            ir => ir.recetaId.trim().toLowerCase() === recetaIdLower
          );

          ingredientesDeReceta.forEach(ir => {
            // Acumular como float — redondear solo al mostrar (evita errores de ±1)
            const cantidadGr = (ir.cantidadKg * 1000) / divisor;
            if (cantidadGr <= 0 || !Number.isFinite(cantidadGr)) return;

            const ingKey = ir.ingredienteId.trim().toLowerCase();
            const ingrediente = ingredientesData.find(i => i.nombre.trim().toLowerCase() === ingKey);
            const ingNombre = ingrediente ? ingrediente.nombre : ir.ingredienteId.trim();

            // Crear entrada dinámica si el ingrediente no estaba en ingredientesData
            if (!ingredientesMap.has(ingKey)) {
              const newItem: ReporteItem = {
                ingredienteNombre: ingNombre,
                cantidadesPorLista: Object.fromEntries(listasOrdenadas.map(l => [l, { A: 0, C: 0 }])),
                total: 0,
                promedio: 0,
              };
              ingredientesMap.set(ingKey, newItem);
            }

            const item = ingredientesMap.get(ingKey)!;
            if (!item.cantidadesPorLista[lista]) item.cantidadesPorLista[lista] = { A: 0, C: 0 };
            item.cantidadesPorLista[lista][tipoPlato] += cantidadGr;
            item.total += cantidadGr;
          });
        });
      };

      procesarPlatos(menu.almuerzo, 'A');
      procesarPlatos(menu.cena, 'C');
    });

    // 5. Calcular promedios y ordenar
    const reporteFinal = Array.from(ingredientesMap.values()).map(item => {
      const totalKg = listasOrdenadas.reduce((s, l) => {
        const a = item.cantidadesPorLista[l]?.A || 0;
        const c = item.cantidadesPorLista[l]?.C || 0;
        return s + (a > 0 ? roundUpPositive(a / 1000) : 0) + (c > 0 ? roundUpPositive(c / 1000) : 0);
      }, 0);
      item.promedio = listasOrdenadas.length > 0 ? roundUpPositive(totalKg / listasOrdenadas.length) : 0;
      return item;
    }).filter(item => item.total > 0)
      .sort((a, b) => a.ingredienteNombre.localeCompare(b.ingredienteNombre));

    return { reporte: reporteFinal, listasUnicas: listasOrdenadas };
  }, [estacion, dieta, menusData, recetasData, ingredientesData, ingredientesRecetaData]); // Dependencias: recalcular si cambian los filtros o los datos

  const getItemTotalKg = (item: ReporteItem) =>
    listasUnicas.reduce((s, l) => {
      const a = item.cantidadesPorLista[l]?.A || 0;
      const c = item.cantidadesPorLista[l]?.C || 0;
      return s + (a > 0 ? toKgDisplay(a) : 0) + (c > 0 ? toKgDisplay(c) : 0);
    }, 0);

  const handleExportarExcel = () => {
    if (!reporte || reporte.length === 0) return;

    const ingredienteMeta = new Map<string, any>(
      ingredientesData.map((ing) => [String(ing.nombre ?? '').trim().toLowerCase(), ing])
    );

    const rows: any[] = [];

    reporte.forEach(item => {
      const meta = ingredienteMeta.get(item.ingredienteNombre.trim().toLowerCase());
      const row: any = {
        Ingrediente: item.ingredienteNombre,
        Grupo: meta?.grupo || '',
        Subgrupo: meta?.subgrupo || '',
      };
      listasUnicas.forEach(lista => {
        const cantA = item.cantidadesPorLista[lista]?.A || 0;
        const cantC = item.cantidadesPorLista[lista]?.C || 0;
        const pad = String(lista).padStart(2, '0');
        row[`${pad} - ${estacion} A`] = cantA > 0 ? toKgDisplay(cantA) : '';
        row[`${pad} - ${estacion} C`] = cantC > 0 ? toKgDisplay(cantC) : '';
      });
      row['Total'] = getItemTotalKg(item);
      row['Promedio'] = item.promedio > 0 ? item.promedio : '';
      rows.push(row);
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    const colWidths = [{ wch: 32 }, { wch: 28 }, { wch: 24 }];
    listasUnicas.forEach(() => { colWidths.push({ wch: 10 }, { wch: 10 }); });
    colWidths.push({ wch: 12 }, { wch: 12 });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ingredientes');
    XLSX.writeFile(workbook, `Reporte_Ingredientes_${estacion}_${dieta}.xlsx`);
  };

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
        <div className="max-w-none">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-2 bg-slate-100 rounded-lg text-slate-600 border border-slate-200">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reporte de Ingredientes</h1>
              </div>
              <p className="text-slate-500 text-sm">Consumo por lista y tipo de comida. Almuerzo (A) y cena (C).</p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 min-h-0 overflow-hidden px-6 py-5">
        <div className="h-full min-h-0 flex flex-col gap-4">
          {/* FILTERS CARD */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="space-y-1.5 md:col-span-4">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Estación</label>
                <Select value={estacion} onValueChange={setEstacion}>
                  <SelectTrigger className="h-10 w-full rounded-md border-slate-200 bg-white text-sm">
                    <SelectValue placeholder="Seleccionar estación..." />
                  </SelectTrigger>
                  <SelectContent align="start" sideOffset={6}>
                    {estacionesOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5 md:col-span-4">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Tipo de Dieta</label>
                <Select value={dieta} onValueChange={setDieta}>
                  <SelectTrigger className="h-10 w-full rounded-md border-slate-200 bg-white text-sm">
                    <SelectValue placeholder="Seleccionar dieta..." />
                  </SelectTrigger>
                  <SelectContent align="start" sideOffset={6}>
                    {dietasOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-3 md:col-span-4">
                <Button 
                  onClick={handleGenerarReporte} 
                  disabled={isLoading}
                  className="flex-1 min-w-0 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm h-10"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Generar Reporte
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleExportarExcel}
                  disabled={!reporte || reporte.length === 0}
                  className="h-10 px-4 border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 shrink-0 shadow-sm"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </div>

            {/* Summary Stats */}
            {menusData && reporte && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-3 mt-3 border-t border-slate-200">
                <div className="bg-[#ebf8f8]/80 rounded-lg p-2 border border-[#cfeeed]">
                  <p className="text-xs text-[#5fc6c3] font-medium uppercase">Ingredientes</p>
                  <p className="text-lg leading-tight font-bold text-[#265b59]">{reporte.length}</p>
                </div>
                <div className="bg-green-50/80 rounded-lg p-2 border border-green-100">
                  <p className="text-xs text-green-600 font-medium uppercase">Listas</p>
                  <p className="text-lg leading-tight font-bold text-green-900">{listasUnicas.length}</p>
                </div>
                <div className="bg-sky-50/80 rounded-lg p-2 border border-sky-100">
                  <p className="text-xs text-sky-700 font-medium uppercase">Total kg</p>
                  <p className="text-lg leading-tight font-bold text-sky-900">{toKgDisplay(reporte.reduce((sum, item) => sum + item.total, 0))}</p>
                </div>
                <div className="bg-amber-50/80 rounded-lg p-2 border border-amber-100">
                  <p className="text-xs text-orange-600 font-medium uppercase">Promedio</p>
                  <p className="text-lg leading-tight font-bold text-orange-900">{roundUpPositive(reporte.reduce((sum, item) => sum + item.total, 0) / (reporte.length * listasUnicas.length || 1))}</p>
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
                    <TableHead className="w-[250px] text-slate-700 font-semibold text-xs tracking-wide py-3 px-4" rowSpan={2}>
                      Ingrediente
                    </TableHead>
                    {listasUnicas.map(lista => (
                      <TableHead key={lista} colSpan={2} className="text-center text-slate-700 font-semibold text-xs tracking-wide py-2 border-l border-slate-200 bg-slate-50">
                        Lista {lista}
                      </TableHead>
                    ))}
                    <TableHead className="text-center text-slate-900 font-bold text-xs tracking-wide border-l border-slate-200 bg-slate-100/50 px-4" rowSpan={2}>
                      TOTAL (g)
                    </TableHead>
                    <TableHead className="text-center text-slate-900 font-bold text-xs tracking-wide border-l border-slate-200 px-4 bg-slate-100/50" rowSpan={2}>
                      PROMEDIO (g)
                    </TableHead>
                  </TableRow>
                  <TableRow className="hover:bg-transparent border-b border-slate-200">
                    {listasUnicas.map(lista => (
                      <React.Fragment key={`${lista}-sub`}>
                        <TableHead className="text-center text-slate-500 font-medium text-xs py-2 border-l border-slate-200 bg-slate-50 w-14">Alm.</TableHead>
                        <TableHead className="text-center text-slate-500 font-medium text-xs py-2 border-l border-slate-200 bg-slate-50 w-14">Cena</TableHead>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                
                  <TableBody>
                  {!menusData ? (
                    <TableRow>
                      <TableCell colSpan={listasUnicas.length * 2 + 3} className="h-44">
                        <div className="flex flex-col items-center justify-center gap-2 py-8">
                          <div className="bg-slate-50 rounded-full p-3 border border-slate-100">
                            <Sparkles className="h-6 w-6 text-slate-400" />
                          </div>
                          <div className="text-center mt-2">
                            <p className="text-sm font-medium text-slate-700">Listo para comenzar</p>
                            <p className="text-xs text-slate-500 mt-1">Configurá los filtros y generá el reporte para ver los datos</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : reporte && reporte.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={listasUnicas.length * 2 + 3} className="h-44">
                        <div className="flex flex-col items-center justify-center gap-2 py-8">
                          <BarChart3 className="h-8 w-8 text-slate-300" />
                          <div className="text-center mt-2">
                            <p className="text-sm font-medium text-slate-700">Sin resultados</p>
                            <p className="text-xs text-slate-500 mt-1">No hay datos para los filtros seleccionados</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    reporte?.map((item, idx) => (
                      <TableRow key={item.ingredienteNombre} className={`hover:bg-slate-100/50 transition-colors border-b border-slate-100 group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <TableCell className={`font-medium text-slate-800 px-4 py-2.5 sticky left-0 z-20 shadow-[1px_0_0_0_rgba(226,232,240,1)] ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'} group-hover:bg-slate-100`}>
                          {item.ingredienteNombre}
                        </TableCell>
                        
                        {listasUnicas.map(lista => {
                          const cantA = item.cantidadesPorLista[lista]?.A || 0;
                          const cantC = item.cantidadesPorLista[lista]?.C || 0;
                          return (
                            <React.Fragment key={`${item.ingredienteNombre}-${lista}`}>
                              <TableCell className={`text-center py-2.5 border-l border-slate-100 ${cantA > 0 ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
                                {cantA > 0 ? toKgDisplay(cantA) : '-'}
                              </TableCell>
                              <TableCell className={`text-center py-2.5 border-l border-slate-100 ${cantC > 0 ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
                                {cantC > 0 ? toKgDisplay(cantC) : '-'}
                              </TableCell>
                            </React.Fragment>
                          );
                        })}
                        
                        <TableCell className="text-center font-semibold text-slate-900 border-l border-slate-200 px-4 py-2.5 bg-slate-50/50">
                          {getItemTotalKg(item)}
                        </TableCell>
                        <TableCell className="text-center font-medium text-slate-700 border-l border-slate-200 px-4 py-2.5 bg-slate-50/50">
                          {item.promedio > 0 ? item.promedio : '-'}
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
