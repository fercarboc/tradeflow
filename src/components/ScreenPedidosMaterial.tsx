import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  ShoppingCart, Plus, Trash2, Send, ChevronDown, ChevronUp,
  CheckCircle, Package, Truck, FileText, X, AlertCircle, Download,
} from 'lucide-react';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, WidthType, BorderStyle, ShadingType, convertInchesToTwip } from 'docx';
import {
  loadSupplierOrders, loadSupplierCatalogs, createSupplierOrder,
  updateSupplierOrderEstado, deleteSupplierOrder, loadCatalogProducts,
  loadAcceptedQuotesWithPendingMaterial, markQuoteItemsOrdered,
} from '../lib/supabase';
import type { SupplierOrder, SupplierOrderLine, TradeQuote, TradeCatalogProduct, QuoteWithPendingMaterial, TradeOrganization } from '../lib/supabase';

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  initialQuote?: TradeQuote | null;
  onClose?: () => void;
  orgData?: TradeOrganization | null;
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
        .filter(i => i.tipo === 'material' && !i.material_order_placed)
        .map((i, idx) => ({
          _key: String(idx),
          descripcion: i.descripcion,
          referencia: i.supplier_ref ?? null,
          cantidad: i.cantidad,
          unidad: 'ud',
          precio_unitario: i.precio_material != null && i.precio_material > 0 ? i.precio_material : (i.precio_unitario > 0 ? i.precio_unitario : null),
        }));
    }
    return [{ _key: '0', descripcion: '', referencia: null, cantidad: 1, unidad: 'ud', precio_unitario: null }];
  });

  useEffect(() => {
    if (!catalogId && catalogs.length > 0) setCatalogId(catalogs[0].id);
  }, [catalogs, catalogId]);

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
      if (initialQuote?.trade_quote_items) {
        const materialIds = initialQuote.trade_quote_items
          .filter(i => i.tipo === 'material' && !i.material_order_placed)
          .map(i => i.id);
        if (materialIds.length) await markQuoteItemsOrdered(materialIds);
      }
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

async function downloadOrderDocx(order: SupplierOrder, orgData?: TradeOrganization | null) {
  const supplier = order.trade_supplier_catalogs?.supplier_name ?? 'Proveedor';
  const supplierEmail = order.trade_supplier_catalogs?.contact_email ?? '';
  const fecha = new Date(order.created_at).toLocaleDateString('es-ES');
  const lines = order.trade_supplier_order_lines ?? [];
  const quoteNumero = order.trade_quotes?.numero ?? '';
  const quoteDescripcion = order.trade_quotes?.descripcion ?? '';
  const clienteNombre = order.trade_quotes?.trade_clients?.nombre ?? '';
  const clienteTelefono = order.trade_quotes?.trade_clients?.telefono ?? '';
  const pedidoRef = `PED-${order.id.slice(0, 8).toUpperCase()}`;
  const total = lines.reduce((s, l) => s + l.cantidad * (l.precio_unitario ?? 0), 0);

  const BLUE = '1D4ED8';
  const LIGHT_BLUE = 'DBEAFE';
  const SLATE = '475569';
  const BORDER_COLOR = 'CBD5E1';

  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR };
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const fullBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
  const sp = (pt: number) => ({ spacing: { after: pt * 20 } });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.8),
            bottom: convertInchesToTwip(0.8),
            left: convertInchesToTwip(0.9),
            right: convertInchesToTwip(0.9),
          },
        },
      },
      children: [
        // Cabecera instalador
        new Paragraph({ children: [new TextRun({ text: orgData?.nombre ?? 'Mi Empresa', bold: true, size: 28, color: BLUE })], ...sp(2) }),
        new Paragraph({
          children: [
            ...(orgData?.nif ? [new TextRun({ text: `NIF: ${orgData.nif}`, size: 18, color: SLATE }), new TextRun({ text: '   ·   ', size: 18, color: SLATE })] : []),
            ...(orgData?.telefono ? [new TextRun({ text: `Tel: ${orgData.telefono}`, size: 18, color: SLATE }), new TextRun({ text: '   ·   ', size: 18, color: SLATE })] : []),
            ...(orgData?.email ? [new TextRun({ text: orgData.email, size: 18, color: SLATE })] : []),
          ],
          ...sp(2),
        }),
        ...(orgData?.direccion ? [new Paragraph({ children: [new TextRun({ text: orgData.direccion, size: 18, color: SLATE })], ...sp(4) })] : [new Paragraph({ ...sp(4) })]),

        // Línea separadora
        new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE } }, children: [new TextRun({ text: '' })], ...sp(8) }),

        // Título + referencia
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 60, type: WidthType.PERCENTAGE },
                  borders: noBorders,
                  children: [new Paragraph({ children: [new TextRun({ text: 'PEDIDO DE MATERIAL', bold: true, size: 36, color: BLUE })] })],
                }),
                new TableCell({
                  width: { size: 40, type: WidthType.PERCENTAGE },
                  borders: noBorders,
                  children: [
                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: pedidoRef, bold: true, size: 20, color: SLATE })] }),
                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Fecha: ${fecha}`, size: 18, color: SLATE })] }),
                  ],
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ ...sp(6) }),

        // Proveedor | Datos del pedido
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.CLEAR, fill: LIGHT_BLUE },
                  borders: fullBorders,
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                  children: [
                    new Paragraph({ children: [new TextRun({ text: 'PROVEEDOR', bold: true, size: 16, color: BLUE })], ...sp(2) }),
                    new Paragraph({ children: [new TextRun({ text: supplier, bold: true, size: 24 })], ...sp(2) }),
                    ...(supplierEmail ? [new Paragraph({ children: [new TextRun({ text: supplierEmail, size: 18, color: SLATE })] })] : []),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: fullBorders,
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                  children: [
                    new Paragraph({ children: [new TextRun({ text: 'DATOS DEL PEDIDO', bold: true, size: 16, color: BLUE })], ...sp(2) }),
                    ...(quoteNumero ? [new Paragraph({ children: [new TextRun({ text: `Presupuesto: `, bold: true, size: 18 }), new TextRun({ text: quoteNumero + (quoteDescripcion ? ` — ${quoteDescripcion}` : ''), size: 18, color: SLATE })] })] : []),
                    ...(clienteNombre ? [new Paragraph({ children: [new TextRun({ text: `Cliente: `, bold: true, size: 18 }), new TextRun({ text: clienteNombre + (clienteTelefono ? ` · ${clienteTelefono}` : ''), size: 18 })] })] : []),
                    new Paragraph({ children: [new TextRun({ text: 'Entrega: ', bold: true, size: 18 }), new TextRun({ text: 'entre 5 y 12 días hábiles', size: 18 })] }),
                  ],
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ ...sp(8) }),

        // Tabla de artículos
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            // Cabecera
            new TableRow({
              tableHeader: true,
              children: [
                new TableCell({ width: { size: 48, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: BLUE }, borders: noBorders, margins: { top: 80, bottom: 80, left: 120, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: 'ARTÍCULO / REFERENCIA', bold: true, size: 18, color: 'FFFFFF' })] })] }),
                new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: BLUE }, borders: noBorders, margins: { top: 80, bottom: 80, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CANT.', bold: true, size: 18, color: 'FFFFFF' })] })] }),
                new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: BLUE }, borders: noBorders, margins: { top: 80, bottom: 80, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'UD.', bold: true, size: 18, color: 'FFFFFF' })] })] }),
                new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: BLUE }, borders: noBorders, margins: { top: 80, bottom: 80, left: 60, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: '€ / UD', bold: true, size: 18, color: 'FFFFFF' })] })] }),
                new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: BLUE }, borders: noBorders, margins: { top: 80, bottom: 80, left: 60, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'TOTAL', bold: true, size: 18, color: 'FFFFFF' })] })] }),
              ],
            }),
            // Filas de artículos
            ...lines.map((l, i) => {
              const rowFill = i % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
              const rowTotal = l.cantidad * (l.precio_unitario ?? 0);
              const descText = l.referencia ? `${l.descripcion} (Ref: ${l.referencia})` : l.descripcion;
              return new TableRow({
                children: [
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: rowFill }, borders: { top: noBorder, bottom: thinBorder, left: thinBorder, right: noBorder }, margins: { top: 60, bottom: 60, left: 120, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: descText, size: 20 })] })] }),
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: rowFill }, borders: { top: noBorder, bottom: thinBorder, left: noBorder, right: noBorder }, margins: { top: 60, bottom: 60, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(l.cantidad), size: 20 })] })] }),
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: rowFill }, borders: { top: noBorder, bottom: thinBorder, left: noBorder, right: noBorder }, margins: { top: 60, bottom: 60, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: l.unidad, size: 20 })] })] }),
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: rowFill }, borders: { top: noBorder, bottom: thinBorder, left: noBorder, right: noBorder }, margins: { top: 60, bottom: 60, left: 60, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: l.precio_unitario != null ? `${Number(l.precio_unitario).toFixed(2)} €` : '—', size: 20 })] })] }),
                  new TableCell({ shading: { type: ShadingType.CLEAR, fill: rowFill }, borders: { top: noBorder, bottom: thinBorder, left: noBorder, right: thinBorder }, margins: { top: 60, bottom: 60, left: 60, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: l.precio_unitario != null ? `${rowTotal.toFixed(2)} €` : '—', size: 20 })] })] }),
                ],
              });
            }),
            // Fila total
            new TableRow({
              children: [
                new TableCell({ columnSpan: 4, shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' }, borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: noBorder }, margins: { top: 80, bottom: 80, left: 120, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'TOTAL NETO (sin IVA)', bold: true, size: 20, color: SLATE })] })] }),
                new TableCell({ shading: { type: ShadingType.CLEAR, fill: LIGHT_BLUE }, borders: { top: thinBorder, bottom: thinBorder, left: noBorder, right: thinBorder }, margins: { top: 80, bottom: 80, left: 60, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${total.toFixed(2)} €`, bold: true, size: 22, color: BLUE })] })] }),
              ],
            }),
          ],
        }),

        new Paragraph({ ...sp(10) }),

        // Condiciones
        new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR } }, children: [new TextRun({ text: 'CONDICIONES Y OBSERVACIONES', bold: true, size: 18, color: SLATE })], ...sp(4) }),
        new Paragraph({ children: [new TextRun({ text: '• Entrega estimada: entre 5 y 12 días hábiles desde la confirmación del pedido.', size: 18 })], ...sp(2) }),
        ...(order.notas ? [new Paragraph({ children: [new TextRun({ text: `• ${order.notas}`, size: 18 })], ...sp(2) })] : []),

        new Paragraph({ ...sp(16) }),

        // Firma
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: noBorders,
                  children: [
                    new Paragraph({ children: [new TextRun({ text: 'Firmado por el solicitante:', size: 18, color: SLATE })], ...sp(20) }),
                    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: SLATE } }, children: [new TextRun({ text: ' ', size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: orgData?.nombre ?? '', size: 18, color: SLATE })] }),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: noBorders,
                  children: [
                    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Lugar y fecha: ____________________________,  ____/____/________', size: 18, color: SLATE })] }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pedido-${supplier.replace(/\s+/g, '-').toLowerCase()}-${new Date(order.created_at).toISOString().split('T')[0]}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function OrderCard({
  order, onUpdated, onDeleted, showToast, orgData,
}: {
  order: SupplierOrder;
  onUpdated: (o: SupplierOrder) => void;
  onDeleted: (id: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  orgData?: TradeOrganization | null;
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
    let ok = false;
    try {
      await updateSupplierOrderEstado(order.id, nextEstado);
      ok = true;
      showToast(`Estado actualizado a ${ESTADO_LABEL[nextEstado]}`, 'success');
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error', 'error');
    } finally {
      setActing(false);
      if (ok) onUpdated({ ...order, estado: nextEstado });
    }
  };

  const cancel = async () => {
    if (!confirm('¿Cancelar este pedido?')) return;
    setActing(true);
    let ok = false;
    try {
      await updateSupplierOrderEstado(order.id, 'cancelado');
      ok = true;
      showToast('Pedido cancelado', 'info');
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error', 'error');
    } finally {
      setActing(false);
      if (ok) onUpdated({ ...order, estado: 'cancelado' });
    }
  };

  const remove = async () => {
    if (!confirm('¿Eliminar este pedido?')) return;
    setActing(true);
    let ok = false;
    try {
      await deleteSupplierOrder(order.id);
      ok = true;
      showToast('Pedido eliminado');
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error', 'error');
    } finally {
      setActing(false);
      if (ok) onDeleted(order.id);
    }
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
              onClick={() => downloadOrderDocx(order, orgData)}
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
  type PendingItem = QuoteWithPendingMaterial['pendingItems'][number];
  type MultiGroup = { catalogId: string | null; supplierName: string; items: PendingItem[] };

  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [catalogId, setCatalogId] = useState(catalogs[0]?.id ?? '');
  const [creating, setCreating] = useState(false);
  const [multiPreview, setMultiPreview] = useState<{
    quoteId: string;
    groups: MultiGroup[];
    unassignedCatalogId: string;
  } | null>(null);

  useEffect(() => {
    if (!catalogId && catalogs.length > 0) setCatalogId(catalogs[0].id);
  }, [catalogs, catalogId]);

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

  const buildGroups = (items: PendingItem[]): MultiGroup[] => {
    const groupMap = new Map<string, MultiGroup>();
    for (const item of items) {
      const key = item.supplier_key ?? '__none__';
      if (!groupMap.has(key)) {
        const cat = catalogs.find(c => c.supplier_key === item.supplier_key);
        groupMap.set(key, {
          catalogId: cat?.id ?? null,
          supplierName: item.supplier_name ?? cat?.supplier_name ?? 'Sin proveedor asignado',
          items: [],
        });
      }
      groupMap.get(key)!.items.push(item);
    }
    return [...groupMap.values()];
  };

  const handleCreateOrder = async (quote: QuoteWithPendingMaterial) => {
    const items = quote.pendingItems.filter(i => selectedItems.has(i.id));
    if (!items.length) { showToast('Selecciona al menos un artículo', 'error'); return; }

    const groups = buildGroups(items);

    if (groups.length > 1) {
      setMultiPreview({ quoteId: quote.id, groups, unassignedCatalogId: catalogId });
      return;
    }

    const group = groups[0];
    const catId = group.catalogId ?? catalogId;
    if (!catId) { showToast('Selecciona un proveedor', 'error'); return; }

    setCreating(true);
    try {
      const lines = group.items.map(i => ({
        descripcion: i.descripcion,
        referencia: null,
        cantidad: i.cantidad,
        unidad: 'ud',
        precio_unitario: i.precio_unitario > 0 ? i.precio_unitario : null,
      }));
      const order = await createSupplierOrder(orgId, catId, lines, { quoteId: quote.id });
      await markQuoteItemsOrdered(group.items.map(i => i.id));
      showToast('Pedido creado ✓', 'success');
      onOrderCreated(order);
      setExpandedQuote(null);
      setSelectedItems(new Set());
      onQuotesRefresh();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error', 'error');
    } finally { setCreating(false); }
  };

  const handleConfirmMultiOrder = async () => {
    if (!multiPreview) return;
    setCreating(true);
    try {
      let firstOrder: SupplierOrder | null = null;
      const allItemIds: string[] = [];
      for (const group of multiPreview.groups) {
        const catId = group.catalogId ?? multiPreview.unassignedCatalogId;
        if (!catId) continue;
        const lines = group.items.map(i => ({
          descripcion: i.descripcion,
          referencia: null,
          cantidad: i.cantidad,
          unidad: 'ud',
          precio_unitario: i.precio_unitario > 0 ? i.precio_unitario : null,
        }));
        const order = await createSupplierOrder(orgId, catId, lines, { quoteId: multiPreview.quoteId });
        if (!firstOrder) firstOrder = order;
        allItemIds.push(...group.items.map(i => i.id));
      }
      if (allItemIds.length) await markQuoteItemsOrdered(allItemIds);
      showToast(`${multiPreview.groups.length} pedidos creados ✓`, 'success');
      if (firstOrder) onOrderCreated(firstOrder);
      setMultiPreview(null);
      setExpandedQuote(null);
      setSelectedItems(new Set());
      onQuotesRefresh();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error', 'error');
    } finally { setCreating(false); }
  };

  if (acceptedQuotes.length === 0) {
    return (
      <>
        {multiPreview && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="px-5 pt-5 pb-4 border-b border-slate-100">
                <h3 className="font-black text-slate-900 text-base">Pedido multi-proveedor</h3>
                <p className="text-sm text-slate-500 mt-1">Se crearán {multiPreview.groups.length} pedidos separados, uno por proveedor.</p>
              </div>
              <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
                {multiPreview.groups.map((group, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="text-sm font-bold text-slate-800 truncate">{group.supplierName}</span>
                      {!group.catalogId && <span className="text-[10px] text-amber-600 font-semibold shrink-0">(sin asignar)</span>}
                      <span className="ml-auto text-xs text-slate-400 shrink-0">{group.items.length} art.</span>
                    </div>
                    {group.items.slice(0, 3).map(it => (
                      <p key={it.id} className="text-xs text-slate-500 truncate pl-5">• {it.descripcion} × {it.cantidad}</p>
                    ))}
                    {group.items.length > 3 && <p className="text-xs text-slate-400 pl-5">... y {group.items.length - 3} más</p>}
                  </div>
                ))}
                {multiPreview.groups.some(g => !g.catalogId) && catalogs.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Proveedor para artículos sin asignar</label>
                    <select
                      value={multiPreview.unassignedCatalogId}
                      onChange={e => setMultiPreview(p => p ? { ...p, unassignedCatalogId: e.target.value } : p)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    >
                      {catalogs.map(c => <option key={c.id} value={c.id}>{c.supplier_name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="px-5 pb-5 pt-2 flex gap-2">
                <button onClick={() => setMultiPreview(null)} disabled={creating} className="flex-1 border border-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-sm">Cancelar</button>
                <button onClick={handleConfirmMultiOrder} disabled={creating} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl text-sm disabled:opacity-50">
                  {creating ? 'Creando...' : `Crear ${multiPreview.groups.length} pedidos`}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
          <FileText className="w-10 h-10 opacity-30" />
          <p className="text-sm font-semibold">No hay presupuestos aceptados con material pendiente</p>
          <p className="text-xs text-center max-w-xs">Cuando un cliente acepte un presupuesto, podrás crear pedidos de material directamente desde aquí.</p>
        </div>
      </>
    );
  }

  return (
    <>
      {multiPreview && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">Pedido multi-proveedor</h3>
              <p className="text-sm text-slate-500 mt-1">Se crearán {multiPreview.groups.length} pedidos separados, uno por proveedor.</p>
            </div>
            <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
              {multiPreview.groups.map((group, i) => (
                <div key={i} className="bg-slate-50 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-sm font-bold text-slate-800 truncate">{group.supplierName}</span>
                    {!group.catalogId && <span className="text-[10px] text-amber-600 font-semibold shrink-0">(sin asignar)</span>}
                    <span className="ml-auto text-xs text-slate-400 shrink-0">{group.items.length} art.</span>
                  </div>
                  {group.items.slice(0, 3).map(it => (
                    <p key={it.id} className="text-xs text-slate-500 truncate pl-5">• {it.descripcion} × {it.cantidad}</p>
                  ))}
                  {group.items.length > 3 && <p className="text-xs text-slate-400 pl-5">... y {group.items.length - 3} más</p>}
                </div>
              ))}
              {multiPreview.groups.some(g => !g.catalogId) && catalogs.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">Proveedor para artículos sin asignar</label>
                  <select
                    value={multiPreview.unassignedCatalogId}
                    onChange={e => setMultiPreview(p => p ? { ...p, unassignedCatalogId: e.target.value } : p)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  >
                    {catalogs.map(c => <option key={c.id} value={c.id}>{c.supplier_name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="px-5 pb-5 pt-2 flex gap-2">
              <button onClick={() => setMultiPreview(null)} disabled={creating} className="flex-1 border border-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-sm">Cancelar</button>
              <button onClick={handleConfirmMultiOrder} disabled={creating} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl text-sm disabled:opacity-50">
                {creating ? 'Creando...' : `Crear ${multiPreview.groups.length} pedidos`}
              </button>
            </div>
          </div>
        </div>
      )}
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

                {(() => {
                  const sel = quote.pendingItems.filter(i => selectedItems.has(i.id));
                  const distinctSuppliers = new Set(sel.map(i => i.supplier_key ?? '__none__')).size;
                  const hasUnassigned = sel.some(i => !i.supplier_key);
                  const showCatalogPicker = catalogs.length > 0 && (distinctSuppliers <= 1 || hasUnassigned);
                  return (
                    <>
                      {showCatalogPicker && (
                        <div>
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 block">
                            {distinctSuppliers > 1 ? 'Proveedor para artículos sin asignar' : 'Proveedor del pedido'}
                          </label>
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
                        disabled={creating || selectedItems.size === 0}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        {creating ? 'Creando...' : distinctSuppliers > 1
                          ? `Revisar y crear ${distinctSuppliers} pedidos (${selectedItems.size} art.)`
                          : `Crear pedido (${selectedItems.size} artículo${selectedItems.size !== 1 ? 's' : ''})`}
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </>
  );
}

export default function ScreenPedidosMaterial({ orgId, showToast, initialQuote, onClose, orgData }: Props) {
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
                  orgData={orgData}
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
                  orgData={orgData}
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
