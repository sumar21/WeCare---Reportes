import { MenuPlanificado, Receta, Ingrediente, IngredienteReceta } from '../types';

export const mockMenus: MenuPlanificado[] = [
  { id: 'M1', estacion: 'Otoño / Invierno', tipo: 'GENERAL', lista: '01 - Otoño / Invierno', almuerzo: 'R1-R2', cena: 'R3' },
  { id: 'M2', estacion: 'Otoño / Invierno', tipo: 'GENERAL', lista: '02 - Otoño / Invierno', almuerzo: 'R4', cena: 'R1-R5' },
  { id: 'M3', estacion: 'Otoño / Invierno', tipo: 'GENERAL', lista: '04 - Otoño / Invierno', almuerzo: 'R6', cena: '' },
];

export const mockRecetas: Receta[] = [
  { id: 'R1', nombre: 'Ensalada', kgTotal: 10, tamanoPorcion: 0.2 }, // 50 porciones
  { id: 'R2', nombre: 'Sopa', kgTotal: 20, tamanoPorcion: 0.25 }, // 80 porciones
  { id: 'R3', nombre: 'Guiso', kgTotal: 15, tamanoPorcion: 0.3 }, // 50 porciones
  { id: 'R4', nombre: 'Pollo al horno', kgTotal: 12, tamanoPorcion: 0.2 }, // 60 porciones
  { id: 'R5', nombre: 'Puré', kgTotal: 10, tamanoPorcion: 0.15 }, // ~66 porciones
  { id: 'R6', nombre: 'Fideos', kgTotal: 8, tamanoPorcion: 0.2 }, // 40 porciones
];

export const mockIngredientes: Ingrediente[] = [
  { id: 'I1', nombre: 'Aceite De Girasol', grupo: 'Grasas', subgrupo: 'Aceites' },
  { id: 'I2', nombre: 'Aceite De Oliva', grupo: 'Grasas', subgrupo: 'Aceites' },
  { id: 'I3', nombre: 'Agua De Red', grupo: 'Bebidas', subgrupo: 'Agua' },
  { id: 'I4', nombre: 'Ajo', grupo: 'Vegetales', subgrupo: 'Bulbos' },
  { id: 'I5', nombre: 'Ajo (Diente)', grupo: 'Vegetales', subgrupo: 'Bulbos' },
  { id: 'I6', nombre: 'Arvejas', grupo: 'Legumbres', subgrupo: 'Frescas' },
  { id: 'I7', nombre: 'Azucar', grupo: 'Azúcares', subgrupo: 'Refinados' },
];

export const mockIngredientesReceta: IngredienteReceta[] = [
  // R1: Ensalada (50 porciones)
  { id: 'IR1', recetaId: 'R1', ingredienteId: 'I2', cantidadKg: 0.05 }, // Aceite de oliva: 50g total -> 1g/porcion
  { id: 'IR2', recetaId: 'R1', ingredienteId: 'I5', cantidadKg: 0.1 },  // Ajo (Diente): 100g total -> 2g/porcion
  
  // R2: Sopa (80 porciones)
  { id: 'IR3', recetaId: 'R2', ingredienteId: 'I3', cantidadKg: 6.64 }, // Agua: 6640g total -> 83g/porcion
  { id: 'IR4', recetaId: 'R2', ingredienteId: 'I6', cantidadKg: 3.92 }, // Arvejas: 3920g total -> 49g/porcion
  
  // R3: Guiso (50 porciones)
  { id: 'IR5', recetaId: 'R3', ingredienteId: 'I7', cantidadKg: 0.95 }, // Azucar: 950g total -> 19g/porcion
  
  // R4: Pollo al horno (60 porciones)
  { id: 'IR6', recetaId: 'R4', ingredienteId: 'I7', cantidadKg: 1.2 },  // Azucar: 1200g total -> 20g/porcion
  
  // R5: Puré (~66 porciones)
  { id: 'IR7', recetaId: 'R5', ingredienteId: 'I2', cantidadKg: 0.132 }, // Aceite de oliva: 132g total -> 2g/porcion
  { id: 'IR8', recetaId: 'R5', ingredienteId: 'I3', cantidadKg: 0.198 }, // Agua: 198g total -> 3g/porcion
  { id: 'IR9', recetaId: 'R5', ingredienteId: 'I4', cantidadKg: 0.066 }, // Ajo: 66g total -> 1g/porcion
  
  // R6: Fideos (40 porciones)
  { id: 'IR10', recetaId: 'R6', ingredienteId: 'I1', cantidadKg: 0.16 }, // Aceite de girasol: 160g total -> 4g/porcion
  { id: 'IR11', recetaId: 'R6', ingredienteId: 'I2', cantidadKg: 0.24 }, // Aceite de oliva: 240g total -> 6g/porcion
  { id: 'IR12', recetaId: 'R6', ingredienteId: 'I5', cantidadKg: 0.04 }, // Ajo (Diente): 40g total -> 1g/porcion
  { id: 'IR13', recetaId: 'R6', ingredienteId: 'I7', cantidadKg: 0.04 }, // Azucar: 40g total -> 1g/porcion
];
