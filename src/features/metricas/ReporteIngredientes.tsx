import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, BarChart3, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/src/components/ui/combobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { mockMenus, mockRecetas, mockIngredientes, mockIngredientesReceta } from '@/src/data/mockData';
import { ReporteItem } from '@/src/types';

export default function ReporteIngredientes() {
  const [estacion, setEstacion] = useState('Otoño / Invierno');
  const [dieta, setDieta] = useState('GENERAL');
  const [tipoReporte, setTipoReporte] = useState('Ingredientes');
  const [isLoading, setIsLoading] = useState(false);
  
  const [menusData, setMenusData] = useState<any[] | null>(null);
  const [recetasData, setRecetasData] = useState<any[]>([]);
  const [ingredientesData, setIngredientesData] = useState<any[]>([]);
  const [ingredientesRecetaData, setIngredientesRecetaData] = useState<any[]>([]);

  const handleGenerarReporte = async () => {
    // 1. Limpiar reporte antes de empezar
    setMenusData(null); 
    setIsLoading(true);
    
    try {
      const proxyFetch = async (url: string, body: any) => {
        const response = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, body })
        });
        if (!response.ok) throw new Error(`Proxy error: ${response.statusText}`);
        return await response.json();
      };

      // Ejecutamos las 4 peticiones en paralelo a través del proxy
      const [dataMenus, dataRecetas, dataIngredientes, dataIngReceta] = await Promise.all([
        proxyFetch('https://default20435c5a4f504349a09a856bdf1f70.49.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/fc2c5bf1c5964073b11ce00bf7e04c13/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=GsH_89WZFKHNoHBiAWbwF_a6sxlCyKhUVfNG_4CKHo8', { estacion, dieta }),
        proxyFetch('https://default20435c5a4f504349a09a856bdf1f70.49.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/f3fe5df02988405b9d71c3bbea67e77e/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=mfHmkDRdK_b36TIVpml-Cotis6nMOaUgbk8zEYJtg4c', {}),
        proxyFetch('https://default20435c5a4f504349a09a856bdf1f70.49.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/b8baede23a634c02b9ecd8575ce7629b/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=QV6rMWUaKfCloM15TFR1ZZkyEfb0cHK0aNvHpGKTpvs', {}),
        proxyFetch('https://default20435c5a4f504349a09a856bdf1f70.49.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/edfea79c4ea4413fb5194c9a81857c41/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=N8RZi2JkastR1f-mmIUzJnk_-d1h1ky2oOqkdSjFi70', {})
      ]);
      
      const formatData = (data: any) => Array.isArray(data) ? data : (data.value || [data]);

      setMenusData(formatData(dataMenus).map((item: any) => ({
        id: String(item.ID || ''),
        dia: item.Title || '',
        lista: String(item.Lista_MP || ''),
        tipo: item.Tipo_MP || '',
        estacion: item.Estacion_MP || '',
        almuerzo: item.Almuerzo_MP || '',
        cena: item.Cena_MP || ''
      })));

      setRecetasData(formatData(dataRecetas).map((item: any) => ({
        id: item.Receta_RE || '',
        nombre: item.Receta_RE || '',
        kgTotal: Number(String(item.KGTotal_RE || '0').replace(',', '.')),
        tamanoPorcion: Number(item.TamanoPorcion_RE || 1)
      })));

      setIngredientesData(formatData(dataIngredientes).map((item: any) => ({
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

      setIngredientesRecetaData(formatData(dataIngReceta).map((item: any) => ({
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

    // 3. Inicializar mapa con TODOS los ingredientes
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
      ingredientesMap.set(ing.nombre, item);
    });

    // 4. Iterar sobre menús y actualizar
    menusFiltrados.forEach(menu => {
      const lista = menu.lista;
      if (!listasSet.has(lista)) return;

      const procesarPlatos = (platosStr: string, tipoPlato: 'A' | 'C') => {
        if (!platosStr) return;
        const recetasIds = platosStr.split('-');
        
        recetasIds.forEach(recetaId => {
          const ingredientesDeReceta = ingredientesRecetaData.filter(ir => ir.recetaId.trim() === recetaId.trim());
          
          ingredientesDeReceta.forEach(ir => {
            const receta = recetasData.find(r => 
              r.nombre.trim().toLowerCase() === recetaId.trim().toLowerCase()
            );
            const ingrediente = ingredientesData.find(i => 
              i.nombre.trim().toLowerCase() === ir.ingredienteId.trim().toLowerCase()
            );

            if (receta && ingrediente) {
              // FÓRMULA DE CÁLCULO (Equivalente a la lógica de CantidadGR en PowerApps)
              // IfError((CantidadRecetaKG_IR * 1000) / (KGTotal_RE / TamanoPorcion_RE); 0; RoundUp((CantidadRecetaKG_IR * 1000) / ((KGTotal_RE * 1000) / TamanoPorcion_RE); 0))
              
              const divisorNormal = receta.kgTotal / receta.tamanoPorcion;
              const divisorPowerApps = (receta.kgTotal * 1000) / receta.tamanoPorcion;
              
              let cantidadGr = 0;
              try {
                // Intentar cálculo normal
                cantidadGr = Math.ceil((ir.cantidadKg * 1000) / divisorNormal);
              } catch (e) {
                // Si falla, usar la lógica de RoundUp del IfError
                cantidadGr = Math.ceil((ir.cantidadKg * 1000) / divisorPowerApps);
              }
              
              if (cantidadGr > 0) {
                const item = ingredientesMap.get(ingrediente.nombre);
                if (item) {
                  item.cantidadesPorLista[lista][tipoPlato] += cantidadGr;
                  item.total += cantidadGr;
                }
              }
            }
          });
        });
      };

      procesarPlatos(menu.almuerzo, 'A');
      procesarPlatos(menu.cena, 'C');
    });

    // 5. Calcular promedios y ordenar
    const reporteFinal = Array.from(ingredientesMap.values()).map(item => {
      item.promedio = listasOrdenadas.length > 0 ? Math.ceil(item.total / listasOrdenadas.length) : 0;
      return item;
    }).sort((a, b) => a.ingredienteNombre.localeCompare(b.ingredienteNombre));

    return { reporte: reporteFinal, listasUnicas: listasOrdenadas };
  }, [estacion, dieta, menusData, recetasData, ingredientesData, ingredientesRecetaData]); // Dependencias: recalcular si cambian los filtros o los datos

  return (
    <div className="flex flex-col h-full bg-slate-50 p-8 relative">
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Loader2 className="h-12 w-12 text-white animate-spin" />
        </div>
      )}
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reporte de Ingredientes</h1>
        <p className="text-slate-500 mt-1">Visualiza y analiza el consumo de ingredientes por lista y tipo de plato.</p>
      </div>

      {/* CONTROLS CARD */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Combobox
            value={estacion}
            onChange={setEstacion}
            placeholder="Estación"
            className="w-[200px]"
            options={[
              { label: "Otoño / Invierno", value: "Otoño / Invierno" },
              { label: "Primavera / Verano", value: "Primavera / Verano" },
            ]}
          />
          
          <Combobox
            value={dieta}
            onChange={setDieta}
            placeholder="Dieta"
            className="w-[200px]"
            options={[
              { label: "GENERAL", value: "GENERAL" },
              { label: "DIABETICO", value: "DIABETICO" },
              { label: "ADECUADO GASTRICO", value: "ADECUADO GASTRICO" },
              { label: "CELIACO", value: "CELIACO" },
              { label: "BLANDO MECANICO", value: "BLANDO MECANICO" },
              { label: "PROCESADO", value: "PROCESADO" },
              { label: "LIQUIDA", value: "LIQUIDA" },
              { label: "NADA POR BOCA", value: "NADA POR BOCA" },
            ]}
          />
          
          <Button 
            onClick={handleGenerarReporte} 
            disabled={isLoading}
            className="bg-slate-900 hover:bg-slate-800 text-white shadow-sm px-6"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Generar Reporte
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" className="gap-2 text-slate-600">
              <FileSpreadsheet className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
          <Table className="min-w-max">
            <TableHeader className="bg-slate-50 sticky top-0 z-10">
              <TableRow className="hover:bg-transparent border-b border-slate-200">
                <TableHead className="w-[250px] text-slate-600 font-semibold text-xs uppercase tracking-wider py-4 px-6" rowSpan={2}>
                  Ingrediente
                </TableHead>
                {listasUnicas.map(lista => (
                  <TableHead key={lista} colSpan={2} className="text-center text-slate-600 font-semibold text-xs uppercase tracking-wider py-3 border-l border-slate-200">
                    Lista {lista}
                  </TableHead>
                ))}
                <TableHead className="text-center text-slate-900 font-bold text-xs uppercase tracking-wider border-l border-slate-200 px-6" rowSpan={2}>
                  TOTAL
                </TableHead>
                <TableHead className="text-center text-slate-900 font-bold text-xs uppercase tracking-wider border-l border-slate-200 px-6" rowSpan={2}>
                  PROMEDIO
                </TableHead>
              </TableRow>
              <TableRow className="hover:bg-transparent border-b border-slate-200">
                {listasUnicas.map(lista => (
                  <React.Fragment key={`${lista}-sub`}>
                    <TableHead className="text-center text-slate-500 font-medium text-xs py-2 border-l border-slate-200">A</TableHead>
                    <TableHead className="text-center text-slate-500 font-medium text-xs py-2 border-l border-slate-200">C</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            
            <TableBody>
              {!menusData ? (
                <TableRow>
                  <TableCell colSpan={listasUnicas.length * 2 + 3} className="h-64 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2 p-6 bg-slate-50 rounded-xl border border-slate-200 max-w-sm mx-auto">
                      <div className="bg-white p-3 rounded-full shadow-sm border border-slate-100">
                        <Play className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-base font-semibold text-slate-700">Listo para generar</p>
                      <p className="text-sm text-slate-500">Selecciona los filtros y haz clic en "Generar Reporte" para comenzar.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : reporte && reporte.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={listasUnicas.length * 2 + 3} className="h-96 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <BarChart3 className="h-10 w-10 text-slate-300" />
                      <p className="text-lg font-medium text-slate-700">No hay datos</p>
                      <p className="text-slate-500">No se encontraron resultados para los filtros seleccionados.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                reporte?.map((item) => (
                  <TableRow key={item.ingredienteNombre} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                    <TableCell className="font-medium text-slate-900 px-6 py-4">
                      {item.ingredienteNombre}
                    </TableCell>
                    
                    {listasUnicas.map(lista => {
                      const cantA = item.cantidadesPorLista[lista]?.A || 0;
                      const cantC = item.cantidadesPorLista[lista]?.C || 0;
                      return (
                        <React.Fragment key={`${item.ingredienteNombre}-${lista}`}>
                          <TableCell className="text-center text-slate-600 border-l border-slate-100 py-4">
                            {cantA > 0 ? cantA : <span className="text-slate-300">-</span>}
                          </TableCell>
                          <TableCell className="text-center text-slate-600 border-l border-slate-100 py-4">
                            {cantC > 0 ? cantC : <span className="text-slate-300">-</span>}
                          </TableCell>
                        </React.Fragment>
                      );
                    })}
                    
                    <TableCell className="text-center font-bold text-slate-900 border-l border-slate-200 px-6 py-4">
                      {item.total > 0 ? item.total : '-'}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-slate-600 border-l border-slate-200 px-6 py-4">
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
  );
}
