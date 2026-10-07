import React from 'react';
import { ActivePage } from '../../types';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
}

export default function MarketplaceComingSoonView({ setCurrentPage }: Props) {
  return (
    <div className="min-h-screen bg-[#020B16] flex flex-col">
      {/* Header minimalista */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <button
          onClick={() => setCurrentPage(ActivePage.Home)}
          className="flex items-center gap-2"
        >
          <img src="/tradeflow.png" alt="TrabFlow" className="h-7" />
        </button>
        <button
          onClick={() => setCurrentPage(ActivePage.Login)}
          className="text-sm text-white/50 hover:text-white/80 transition"
        >
          Acceder
        </button>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-full max-w-2xl">
          {/* Etiqueta */}
          <span className="inline-block px-3 py-1 rounded-full bg-[#1a3a5c] text-[#4da6ff] text-xs font-semibold tracking-widest uppercase mb-6">
            Próximamente
          </span>

          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
            El Marketplace de materiales<br className="hidden sm:block" /> para instaladores profesionales
          </h1>

          <p className="text-white/55 text-base sm:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Compra materiales directamente desde tus presupuestos, compara precios de múltiples proveedores
            y recibe seguimiento en tiempo real — todo integrado en TrabFlow.
          </p>

          {/* Imagen demo */}
          <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl mb-10">
            <img
              src="/demomarketplace.png"
              alt="Vista previa del Marketplace de TrabFlow"
              className="w-full h-auto object-cover"
            />
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setCurrentPage(ActivePage.Home)}
              className="w-full sm:w-auto px-6 py-3 bg-[#1a78c2] hover:bg-[#1a6aad] text-white font-semibold rounded-xl transition text-sm"
            >
              Descubrir TrabFlow
            </button>
            <button
              onClick={() => setCurrentPage(ActivePage.Registro)}
              className="w-full sm:w-auto px-6 py-3 bg-white/8 hover:bg-white/12 text-white font-medium rounded-xl transition text-sm border border-white/10"
            >
              Crear cuenta gratuita
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
