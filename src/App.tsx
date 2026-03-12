/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Sidebar from './components/layout/Sidebar';
import ReporteIngredientes from './features/metricas/ReporteIngredientes';

export default function App() {
  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <ReporteIngredientes />
      </main>
    </div>
  );
}
