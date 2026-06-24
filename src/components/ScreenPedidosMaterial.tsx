import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  ShoppingCart, Plus, Trash2, Send, ChevronDown, ChevronUp,
  CheckCircle, Package, Truck, FileText, X, AlertCircle, Download,
} from 'lucide-react';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, BorderStyle } from 'docx';
import {
  loadSupplierOrders, loadSupplierCatalogs, createSupplierOrder,
  updateSupplierOrderEstado, deleteSupplierOrder, loadCatalogProducts,
  loadAcceptedQuotesWithPendingMaterial, markQuoteItemsOrdered,
} from '../lib/supabase';
import type { SupplierOrder, SupplierOrderLine, TradeQuote, TradeCatalogProduct, QuoteWithPendingMaterial } from '../lib/supabase';

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  initialQuote?: TradeQuote | null;
  onClose?: () => void;
}

const ESTADO_LABEL: Record<SupplierOrder['estado'], string> = {
  borrador: 'Borrador', enviado: 'Enviado', confirmado: 'Confirmado',
  recibido: 'Recibido', cancelado: 'Cancelado',
};
const ESTADO_COLOR: Record<SupplierOrder['estado'], string> = {
  borrador: 'bg-slate-100 text-slate-600',
  enviado: 'bg-amber-100 text-amber-700',
  confirmado: 'bg-blue-100 text-blue-700',
  recibido: 'bg-emerald-100 text-emerald-700',
  cancelado: 'bg-red-100 text-red-600',
};

function ArticleSearchInput({
  value, onChange, onProductSelect, catalogProducts, disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  onProductSelect: (descripcion: string, unidad: string, precio: number | null) => void;
  catalogProducts: TradeCatalogProduct[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim() || value.length < 2) return [];
    const q = value.toLowerCase();
    return catalogProducts
      .filter(p =>
        p.nombre_generico.toLowerCase().includes(q) ||
        p.familia.toLowerCase().includes(q) ||
        (p.subfamilia?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 8);
  }, [value, catalogProducts]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (product: TradeCatalogProduct) => {
    const preferred = product.trade_catalog_variants?.find(v => v.is_preferred && v.activo)
      ?? product.trade_catalog_variants?.find(v => v.activo);
    onProductSelect(product.nombre_generico, product.unidad, preferred?.precio_material ?? null);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <input
        disabled={disabled}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (value.length >= 2) setOpen(true); }}
        placeholder="Descripción del material"
        className="text-sm text-slate-800 bg-transparent focus:outline-none w-full disabled:text-slate-500"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto">
          {filtered.map(p => {
            const pref = p.trade_catalog_variants?.find(v => v.is_preferred && v.activo)
              ?? p.trade_catalog_variants?.find(v => v.activo);
            return (
              <button
                key={p.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(p); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex flex-col gap-0.5 border-b border-slate-50 last:border-0"
              >
                <span className="text-sm font-semibold text-slate-800 truncate">{p.nombre_generico}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 truncate">{p.familia}{p.subfamilia ? ` · ${p.subfamilia}` : ''}</span>
                  {pref && (
                    <span className="text-[10px] font-bold text-blue-600 shrink-0">
                      {pref.precio_material.toFixed(2)} € / {p.unidad}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrderLineRow({
  line, onDelete, onChange, onProductSelect, editable, catalogProducts,
}: {
  line: SupplierOrderLine & { _key?: string };
  onDelete: () => void;
  onChange: (field: keyof SupplierOrderLine, val: string) => void;
  onProductSelect?: (descripcion: string, unidad: string, precio: number | null) => void;
  editable: boolean;
  catalogProducts?: TradeCatalogProduct[];
}) {
  return (
    <div className="grid grid-cols-[1fr_80px_80px_80px_32px] gap-2 items-center py-1.5 border-b border-slate-100 last:border-0">
      {editable && catalogProducts && onProductSelect ? (
        <ArticleSearchInput
          value={line.descripcion}
          onChange={val => onChange('descripcion', val)}
          onProductSelect={onProductSelect}
          catalogProducts={catalogProducts}
        />
      ) : (
      <input
        disabled={!editable}
        value={line.descripcion}
        onChange={e => onChange('descripcion', e.target.value)}
        placeholder="Descripción del material"
        className="text-sm text-slate-800 bg-transparent focus:outline-none w-full disabled:text-slate-500"
      />
      )}
      <input
        disabled={!editable}
        type="number" min="1" step="1"
        value={line.cantidad}
        onChange={e => onChange('cantidad', e.target.value)}
        className="text-sm text-center bg-slate-50 border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent"
      />
      <input
        disabled={!editable}
        value={line.unidad}
        onChange={e => onChange('unidad', e.target.value)}
        className="text-sm text-center bg-slate-50 border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent"
      />
      <input
        disabled={!editable}
        type="number" min="0" step="0.01"
        value={line.precio_unitario ?? ''}
        onChange={e => onChange('precio_unitario', e.target.value)}
        placeholder="—"
        className="text-sm text-center bg-slate-50 border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400 disabled:bg-transparent disabled:border-transparent"
      />
      {editable ? (
        <button onClick={onDelete} className="text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ) : <div />}
    </div>
  );
}

type DraftLine = Omit<SupplierOrderLine, 'id' | 'order_id' | 'created_at'> & { _key: string };

function NewOrderModal({
  orgId, catalogs, catalogProducts, initialQuote, onCreated, onClose, showToast,
}: {
  orgId: string;
  catalogs: { id: string; supplier_name: string; supplier_key: string; contact_email?: string | null }[];
  catalogProducts: TradeCatalogProduct[];
  initialQuote?: TradeQuote | null;
  onCreated: (order: SupplierOrder) => void;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [catalogId, setCatalogId] = useState(catalogs[0]?.id ?? '');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (initialQuote?.trade_quote_items?.length) {
      return initialQuote.trade_quote_items
        .filter(i => i.tipo === 'material')
        .map((i, idx) => ({
          _key: String(idx),
          descripcion: i.descripcion,
          referencia: null,
          cantidad: i.cantidad,
          unidad: 'ud',
          precio_unitario: null,
        }));
    }
    return [{ _key: '0', descripcion: '', referencia: null, cantidad: 1, unidad: 'ud', precio_unitario: null }];
  });

  const addLine = () => setLines(prev => [
    ...prev,
    { _key: String(Date.now()), descripcion: '', referencia: null, cantidad: 1, unidad: 'ud', precio_unitario: null },
  ]);

  const deleteLine = (key: string) => setLines(prev => prev.filter(l => l._key !== key));

  const changeLine = (key: string, field: keyof SupplierOrderLine, val: string) => {
    setLines(prev => prev.map(l => {
      if (l._key !== key) return l;
      if (field === 'cantidad') return { ...l, cantidad: Math.max(1, parseInt(val, 10) || 1) };
      if (field === 'precio_unitario') return { ...l, precio_unitario: val === '' ? null : parseFloat(val) };
      return { ...l, [field]: val };
    }));
  };

  const selectProduct = (key: string, descripcion: string, unidad: string, precio: number | null) => {
    setLines(prev => prev.map(l =>
      l._key !== key ? l : { ...l, descripcion, unidad, precio_unitario: precio },
    ));
  };

  const handleCreate = async () => {
    if (!catalogId) { showToast('Selecciona un proveedor', 'error'); return; }
    const validLines = lines.filter(l => l.descripcion.trim());
    if (!validLines.length) { showToast('Añade al menos un artículo', 'error'); return; }
    setSaving(true);
    try {
      const order = await createSupplierOrder(
        orgId,
        catalogId,
        validLines.map(({ _key: _k, ...l }) => l),
        { quoteId: initialQuote?.id, notas: notas.trim() || undefined },
      );
      showToast('Pedido creado ✓', 'success');
      onCreated(order);
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error al crear', 'error');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <h3 className="font-black text-slate-900 text-base">Nuevo pedido de material</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {initialQuote && (
            <div className="bg-blue-50 rounded-xl px-3 py-2 flex items-center gap-2 text-sm text-blue-700">
              <FileText className="w-4 h-4 shrink-0" />
              <span>Presupuesto <strong>{initialQuote.numero}</strong> — {initialQuote.descripcion ?? 'sin descripción'}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Proveedor</label>
            <select
              value={catalogId}
              onChange={e => setCatalogId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-400"
            >
              {catalogs.map(c => (
                <option key={c.id} value={c.id}>{c.supplier_name}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="grid grid-cols-[1fr_80px_80px_80px_32px] gap-2 mb-1">
              <span className="text-xs font-bold text-slate-400 uppercase">Artículo</span>
              <span className="text-xs font-bold text-slate-400 uppercase text-center">Cant.</span>
              <span className="text-xs font-bold text-slate-400 uppercase text-center">Ud.</span>
              <span className="text-xs font-bold text-slate-400 uppercase text-center">€/ud</span>
              <div />
            </div>
            {lines.map(line => (
              <OrderLineRow
                key={line._key}
                line={line as unknown as SupplierOrderLine & { _key: string }}
                editable
                catalogProducts={catalogProducts}
                onDelete={() => deleteLine(line._key)}
                onChange={(field, val) => changeLine(line._key, field, val)}
                onProductSelect={(desc, unid, precio) => selectProduct(line._key, desc, unid, precio)}
              />
            ))}
            <button onClick={addLine} className="mt-2 flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700">
              <Plus className="w-3.5 h-3.5" /> Añadir artículo
            </button>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Notas para el proveedor</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Fecha de entrega, número de cuenta, observaciones..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-slate-100">
          <button
            onClick={handleCreate}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3.5 rounded-2xl text-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}

async function downloadOrderDocx(order: SupplierOrder) {
  const supplier = order.trade_supplier_catalogs?.supplier_name ?? 'Proveedor';
  const fecha = new Date(order.created_at).toLocaleDateString('es-ES');
  const lines = order.trade_supplier_order_lines ?? [];
  const quoteRef = order.trade_quotes ? `Presupuesto: ${order.trade_quotes.numero} — ${order.trade_quotes.descripcion ?? ''}` : '';

  const NO_BORDER = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  const headerRow = new TableRow({
    children: [
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'ARTÍCULO', bold: true, size: 18, color: '475569' })] })], borders: NO_BORDER }),
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'CANT.', bold: true, size: 18, color: '475569' })], alignment: AlignmentType.CENTER })], borders: NO_BORDER }),
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'UD.', bold: true, size: 18, color: '475569' })], alignment: AlignmentType.CENTER })], borders: NO_BORDER }),
      new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: '€/UD', bold: true, size: 18, color: '475569' })], alignment: AlignmentType.RIGHT })], borders: NO_BORDER }),
    ],
    tableHeader: true,
  });

  const dataRows = lines.map(l => new TableRow({
    children: [
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: l.descripcion, size: 20 })] })], borders: NO_BORDER }),
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: String(l.cantidad), size: 20 })], alignment: AlignmentType.CENTER })], borders: NO_BORDER }),
      new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: l.unidad, size: 20 })], alignment: AlignmentType.CENTER })], borders: NO_BORDER }),
      new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: l.precio_unitario ? `${l.precio_unitario} €` : '—', size: 20 })], alignment: AlignmentType.RIGHT })], borders: NO_BORDER }),
    ],
  }));

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: 'PEDIDO DE MATERIAL', bold: true, size: 32, color: '2563EB' })] }),
        new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
        new Paragraph({ children: [new TextRun({ text: `Proveedor: `, bold: true, size: 22 }), new TextRun({ text: supplier, size: 22 })] }),
        new Paragraph({ children: [new TextRun({ text: `Fecha: `, bold: true, size: 22 }), new TextRun({ text: fecha, size: 22 })] }),
        ...(quoteRef ? [new Paragraph({ children: [new TextRun({ text: quoteRef, size: 20, color: '475569' })] })] : []),
        new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows],
        }),
        ...(order.notas ? [
          new Paragraph({ children: [new TextRun({ text: ' ', size: 10 })] }),
          new Paragraph({ children: [new TextRun({ text: 'Notas: ', bold: true, size: 20 }), new TextRun({ text: order.notas, size: 20 })] }),
        ] : []),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pedido-${supplier.replace(/\s+/g, '-').toLowerCase()}-${fecha.replace(/\//g, '-')}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function OrderCard({
  order, onUpdated, onDeleted, showToast,
}: {
  order: SupplierOrder;
  onUpdated: (o: SupplierOrder) => void;
  onDeleted: (id: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const editable = order.estado === 'borrador';

  const advance = async () => {
    const next: Record<string, SupplierOrder['estado']> = {
      borrador: 'enviado', enviado: 'confirmado', confirmado: 'recibido',
    };
    const nextEstado = next[order.estado];
    if (!nextEstado) return;
    setActing(true);
    try {
      await updateSupplierOrderEstado(order.id, nextEstado);
      onUpdated({ ...order, estado: nextEstado });
      showToast(`Estado actualizado a ${ESTADO_LABEL[nextEstado]}`, 'success');
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error', 'error');
    } finally { setActing(false); }
  };

  const cancel = async () => {
    if (!confirm('¿Cancelar este pedido?')) return;
    setActing(true);
    try {
      await updateSupplierOrderEstado(order.id, 'cancelado');
      onUpdated({ ...order, estado: 'cancelado' });
      showToast('Pedido cancelado', 'info');
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error', 'error');
    } finally { setActing(false); }
  };

  const remove = async () => {
    if (!confirm('¿Eliminar este pedido?')) return;
    setActing(true);
    try {
      await deleteSupplierOrder(order.id);
      onDeleted(order.id);
      showToast('Pedido eliminado');
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error', 'error');
    } finally { setActing(false); }
  };

  const sendWhatsApp = () => {
    const supplier = order.trade_supplier_catalogs?.supplier_name ?? 'Proveedor';
    const lines = (order.trade_supplier_order_lines ?? [])
      .map(l => `• ${l.descripcion} — ${l.cantidad} ${l.unidad}`)
      .join('\n');
    const quoteRef = order.trade_quotes ? ` (Pres. ${order.trade_quotes.numero})` : '';
    const msg = `Hola, me gustaría solicitar el siguiente pedido de material${quoteRef}:\n\n${lines}${order.notas ? `\n\nNotas: ${order.notas}` : ''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const sendEmail = () => {
    const supplier = order.trade_supplier_catalogs?.supplier_name ?? 'Proveedor';
    const email = order.trade_supplier_catalogs?.contact_email ?? '';
    const lines = (order.trade_supplier_order_lines ?? [])
      .map(l => `- ${l.descripcion}: ${l.cantidad} ${l.unidad}${l.precio_unitario ? ` @ ${l.precio_unitario}€` : ''}`)
      .join('\n');
    const subject = encodeURIComponent(`Pedido de material — ${supplier}`);
    const body = encodeURIComponent(`Estimados,\n\nSolicito el siguiente material:\n\n${lines}${order.notas ? `\n\nObservaciones: ${order.notas}` : ''}\n\nGracias.`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const lineCount = order.trade_supplier_order_lines?.length ?? 0;
  const nextActions: Record<string, string> = {
    borrador: 'Marcar como enviado', enviado: 'Confirmar recepción pedido', confirmado: 'Marcar material recibido',
  };

  return (
    <div className={`bg-white rounded-2xl border ${order.estado === 'cancelado' ? 'border-slate-100 opacity-60' : 'border-slate-200'} overflow-hidden`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
          <ShoppingCart className="w-4 h-4 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-slate-900 text-sm truncate">
              {order.trade_supplier_catalogs?.supplier_name ?? '—'}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ESTADO_COLOR[order.estado]}`}>
              {ESTADO_LABEL[order.estado]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-slate-500">{lineCount} artículo{lineCount !== 1 ? 's' : ''}</span>
            {order.trade_quotes && (
              <span className="text-xs text-blue-600">Pres. {order.trade_quotes.numero}</span>
            )}
            <span className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString('es-ES')}</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {(order.trade_supplier_order_lines ?? []).length > 0 && (
            <div>
              <div className="grid grid-cols-[1fr_80px_80px_80px_32px] gap-2 mb-1">
                <span className="text-xs font-bold text-slate-400 uppercase">Artículo</span>
                <span className="text-xs font-bold text-slate-400 uppercase text-center">Cant.</span>
                <span className="text-xs font-bold text-slate-400 uppercase text-center">Ud.</span>
                <span className="text-xs font-bold text-slate-400 uppercase text-center">€/ud</span>
                <div />
              </div>
              {(order.trade_supplier_order_lines ?? []).map(line => (
                <OrderLineRow
                  key={line.id}
                  line={{ ...line, _key: line.id }}
                  editable={false}
                  onDelete={() => {}}
                  onChange={() => {}}
                />
              ))}
            </div>
          )}

          {order.notas && (
            <p className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2 italic">{order.notas}</p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => downloadOrderDocx(order)}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Descargar DOCX
            </button>
            {order.estado === 'borrador' && (
              <>
                <button
                  onClick={sendWhatsApp}
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
                >
                  <Send className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button
                  onClick={sendEmail}
                  className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
                >
                  <Send className="w-3.5 h-3.5" /> Email
                </button>
              </>
            )}

            {nextActions[order.estado] && (
              <button
                onClick={advance}
                disabled={acting}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" /> {nextActions[order.estado]}
              </button>
            )}

            {(order.estado === 'borrador' || order.estado === 'enviado') && (
              <button
                onClick={cancel}
                disabled={acting}
                className="text-xs font-bold text-red-500 hover:text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
              >
                Cancelar
              </button>
            )}

            {order.estado === 'borrador' && (
              <button
                onClick={remove}
                disabled={acting}
                className="text-xs font-bold text-slate-400 hover:text-red-500 px-2 py-2 rounded-xl hover:bg-red-50 transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FromQuoteSection({
  orgId, catalogs, acceptedQuotes, onOrderCreated, showToast, onQuotesRefresh,
}: {
  orgId: string;
  catalogs: { id: string; supplier_name: string; supplier_key: string; contact_email?: string | null }[];
  acceptedQuotes: QuoteWithPendingMaterial[];
  onOrderCreated: (order: SupplierOrder) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onQuotesRefresh: () => void;
}) {
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [catalogId, setCatalogId] = useState(catalogs[0]?.id ?? '');
  const [creating, setCreating] = useState(false);

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExpand = (quoteId: string) => {
    setExpandedQuote(prev => prev === quoteId ? null : quoteId);
    setSelectedItems(new Set());
  };

  const handleCreateOrder = async (quote: QuoteWithPendingMaterial) => {
    if (!catalogId) { showToast('Selecciona un proveedor', 'error'); return; }
    const items = quote.pendingItems.filter(i => selectedItems.has(i.id));
    if (!items.length) { showToast('Selecciona al menos un artículo', 'error'); return; }
    setCreating(true);
    try {
      const lines = items.map(i => ({
        descripcion: i.descripcion,
        referencia: null,
        cantidad: i.cantidad,
        unidad: 'ud',
        precio_unitario: null,
      }));
      const order = await createSupplierOrder(orgId, catalogId, lines, {});
      await markQuoteItemsOrdered(items.map(i => i.id));
      showToast('Pedido creado ✓', 'success');
      onOrderCreated(order);
      setExpandedQuote(null);
      setSelectedItems(new Set());
      onQuotesRefresh();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error', 'error');
    } finally { setCreating(false); }
  };

  if (acceptedQuotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
        <FileText className="w-10 h-10 opacity-30" />
        <p className="text-sm font-semibold">No hay presupuestos aceptados con material pendiente</p>
        <p className="text-xs text-center max-w-xs">Cuando un cliente acepte un presupuesto, podrás crear pedidos de material directamente desde aquí.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {acceptedQuotes.map(quote => {
        const isExpanded = expandedQuote === quote.id;
        const allSelected = quote.pendingItems.every(i => selectedItems.has(i.id));
        return (
          <div key={quote.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              onClick={() => handleExpand(quote.id)}
            >
              <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900 text-sm">{quote.numero}</span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Aceptado</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {quote.cliente_nombre && <span className="text-xs text-slate-500">{quote.cliente_nombre}</span>}
                  <span className="text-xs text-slate-400">{quote.pendingItems.length} artículo{quote.pendingItems.length !== 1 ? 's' : ''} pendiente{quote.pendingItems.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSelectedItems(allSelected ? new Set() : new Set(quote.pendingItems.map(i => i.id)))}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                  <span className="text-xs text-slate-400">{selectedItems.size} seleccionados</span>
                </div>

                <div className="space-y-1">
                  {quote.pendingItems.map(item => (
                    <label key={item.id} className="flex items-center gap-3 py-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleItem(item.id)}
                        className="accent-blue-600 w-4 h-4 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-800 font-medium">{item.descripcion}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">{item.cantidad} ud</span>
                          {item.supplier_name && (
                            <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{item.supplier_name}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                {catalogs.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Proveedor del pedido</label>
                    <select
                      value={catalogId}
                      onChange={e => setCatalogId(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-400"
                    >
                      {catalogs.map(c => <option key={c.id} value={c.id}>{c.supplier_name}</option>)}
                    </select>
                  </div>
                )}

                <button
                  onClick={() => handleCreateOrder(quote)}
                  disabled={creating || selectedItems.size === 0 || !catalogId}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {creating ? 'Creando pedido...' : `Crear pedido (${selectedItems.size} artículo${selectedItems.size !== 1 ? 's' : ''})`}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ScreenPedidosMaterial({ orgId, showToast, initialQuote, onClose }: Props) {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [catalogs, setCatalogs] = useState<{ id: string; supplier_name: string; supplier_key: string; contact_email?: string | null }[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<TradeCatalogProduct[]>([]);
  const [acceptedQuotes, setAcceptedQuotes] = useState<QuoteWithPendingMaterial[]>([]);
  const [activeTab, setActiveTab] = useState<'pedidos' | 'presupuestos'>('pedidos');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(!!initialQuote);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ords, cats, prods, quotes] = await Promise.all([
        loadSupplierOrders(orgId),
        loadSupplierCatalogs(orgId),
        loadCatalogProducts(orgId),
        loadAcceptedQuotesWithPendingMaterial(orgId),
      ]);
      setOrders(ords);
      setCatalogs(cats);
      setCatalogProducts(prods);
      setAcceptedQuotes(quotes);
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error cargando pedidos', 'error');
    } finally { setLoading(false); }
  }, [orgId, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleCreated = (order: SupplierOrder) => {
    setOrders(prev => [order, ...prev]);
    setShowNew(false);
    onClose?.();
  };

  const active = orders.filter(o => o.estado !== 'cancelado' && o.estado !== 'recibido');
  const history = orders.filter(o => o.estado === 'recibido' || o.estado === 'cancelado');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-blue-600" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Pedidos de Material</h2>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo pedido
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
        <button
          onClick={() => setActiveTab('pedidos')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'pedidos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <ShoppingCart className="w-3.5 h-3.5" /> Mis pedidos
        </button>
        <button
          onClick={() => setActiveTab('presupuestos')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'presupuestos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <FileText className="w-3.5 h-3.5" />
          Desde presupuestos
          {acceptedQuotes.length > 0 && (
            <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{acceptedQuotes.length}</span>
          )}
        </button>
      </div>

      {activeTab === 'presupuestos' && (
        <FromQuoteSection
          orgId={orgId}
          catalogs={catalogs}
          acceptedQuotes={acceptedQuotes}
          onOrderCreated={order => setOrders(prev => [order, ...prev])}
          showToast={showToast}
          onQuotesRefresh={load}
        />
      )}

      {activeTab === 'pedidos' && <>
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Activos', val: active.length, icon: <Package className="w-4 h-4 text-blue-500" />, bg: 'bg-blue-50' },
          { label: 'Enviados', val: orders.filter(o => o.estado === 'enviado').length, icon: <Send className="w-4 h-4 text-amber-500" />, bg: 'bg-amber-50' },
          { label: 'Recibidos', val: orders.filter(o => o.estado === 'recibido').length, icon: <CheckCircle className="w-4 h-4 text-emerald-500" />, bg: 'bg-emerald-50' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-2xl px-3 py-3 flex flex-col gap-1`}>
            <div className="flex items-center gap-1.5">{k.icon}<span className="text-xs font-bold text-slate-500">{k.label}</span></div>
            <span className="text-xl font-black text-slate-900">{k.val}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-blue-200 border-t-blue-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <Truck className="w-12 h-12 opacity-30" />
          <p className="text-sm font-semibold">Aún no tienes pedidos de material</p>
          <p className="text-xs text-center max-w-xs">Crea un pedido desde un presupuesto o directamente para solicitar materiales a tus proveedores.</p>
          {catalogs.length === 0 && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 rounded-xl px-4 py-2.5 text-xs font-semibold mt-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Activa proveedores en Ajustes → Proveedores
            </div>
          )}
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">En curso</h3>
              {active.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onUpdated={updated => setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))}
                  onDeleted={id => setOrders(prev => prev.filter(o => o.id !== id))}
                  showToast={showToast}
                />
              ))}
            </section>
          )}

          {history.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Historial</h3>
              {history.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onUpdated={updated => setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))}
                  onDeleted={id => setOrders(prev => prev.filter(o => o.id !== id))}
                  showToast={showToast}
                />
              ))}
            </section>
          )}
        </>
      )}

      {showNew && (
        <NewOrderModal
          orgId={orgId}
          catalogs={catalogs}
          catalogProducts={catalogProducts}
          initialQuote={initialQuote ?? null}
          onCreated={handleCreated}
          onClose={() => { setShowNew(false); onClose?.(); }}
          showToast={showToast}
        />
      )}
      </>}
    </div>
  );
}
