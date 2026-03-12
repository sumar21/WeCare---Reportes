export interface MenuPlanificado {
  id: string;
  estacion: string; // Ej: "Otoño / Invierno"
  tipo: string; // Ej: "GENERAL", "DIABETICO"
  lista: string; // ConcatEstacioNum_MP, Ej: "01 - Otoño / Invierno"
  almuerzo: string; // IDs de recetas separados por guión, Ej: "R1-R2"
  cena: string; // IDs de recetas separados por guión, Ej: "R3-R4"
}

export interface Receta {
  id: string; // Receta_RE
  nombre: string;
  kgTotal: number; // KGTotal_RE
  tamanoPorcion: number; // TamanoPorcion_RE
}

export interface Ingrediente {
  id: string; // Ingrediente_IN
  nombre: string;
  grupo: string; // Grupo_IN
  subgrupo: string; // SubGrupo_IN
}

export interface IngredienteReceta {
  id: string;
  recetaId: string; // Receta_IR
  ingredienteId: string; // Ingrediente_IR
  cantidadKg: number; // CantidadRecetaKG_IR
}

// Tipo para el resultado final del cálculo
export interface ReporteItem {
  ingredienteNombre: string;
  cantidadesPorLista: Record<string, { A: number; C: number }>;
  total: number;
  promedio: number;
}
