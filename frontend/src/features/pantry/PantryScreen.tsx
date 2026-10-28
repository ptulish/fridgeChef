import React, { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { PantryItem, Ingredient, InventoryTransaction } from '../../types';
import { useI18n } from '../../app/I18nContext';
import {
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
  Edit3,
  X,
  Check,
  Ban,
  Search,
  Sparkles,
  List,
  History,
  Undo2,
} from 'lucide-react';

const CATEGORY_MAP: { [key: string]: { labelKey: string; defaultUnit: string } } = {
  produce: { labelKey: 'category_produce', defaultUnit: 'pcs' },
  meat: { labelKey: 'category_meat', defaultUnit: 'g' },
  sauce: { labelKey: 'category_sauce', defaultUnit: 'ml' },
  oil: { labelKey: 'category_oil', defaultUnit: 'ml' },
  spice: { labelKey: 'category_spice', defaultUnit: 'g' },
  noodles: { labelKey: 'category_noodles', defaultUnit: 'g' },
  staple: { labelKey: 'category_staple', defaultUnit: 'g' },
  dairy: { labelKey: 'category_dairy', defaultUnit: 'pcs' },
  other: { labelKey: 'category_other', defaultUnit: 'pcs' },
};

export const PantryScreen: React.FC = () => {
  const { t } = useI18n();

  const getCategoryLabel = (cat?: string) => {
    if (!cat) return t('category_other');
    const info = CATEGORY_MAP[cat];
    if (info) return t(info.labelKey as any);
    return cat;
  };
  const [items, setItems] = useState<PantryItem[]>([]);
  const [catalog, setCatalog] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'needs_confirmation' | 'in_stock' | 'out'>('all');
  const [storageZoneFilter, setStorageZoneFilter] = useState<'all' | 'fridge' | 'freezer' | 'pantry' | 'staples'>('all');

  // Ledger / Transactions History
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  
  // Quick confirm modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmingItems, setConfirmingItems] = useState<{ [id: string]: { quantity: string; unit: string; status: string } }>({});

  // Add item modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'catalog' | 'custom'>('catalog');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('produce');
  const [addQty, setAddQty] = useState('');
  const [addUnit, setAddUnit] = useState('g');
  const [addStatus, setAddStatus] = useState('in_stock');
  const [addStorageZone, setAddStorageZone] = useState<'fridge' | 'freezer' | 'pantry'>('fridge');
  const [addFuzzyLevel, setAddFuzzyLevel] = useState<string>('full');
  const [addIsStaple, setAddIsStaple] = useState(false);
  const [addNotes, setAddNotes] = useState('');

  // Edit Single Item Modal (opened on clicking any card)
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [editQty, setEditQty] = useState<string>('');
  const [editUnit, setEditUnit] = useState<string>('g');
  const [editStatus, setEditStatus] = useState<string>('in_stock');
  const [editStorageZone, setEditStorageZone] = useState<'fridge' | 'freezer' | 'pantry'>('fridge');
  const [editFuzzyLevel, setEditFuzzyLevel] = useState<string>('full');
  const [editIsStaple, setEditIsStaple] = useState<boolean>(false);
  const [editPackageSize, setEditPackageSize] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pantryData, catData] = await Promise.all([
        api.getPantry(),
        api.getCanonicalIngredients(),
      ]);
      setItems(pantryData);
      setCatalog(catData);
      if (catData.length > 0) {
        setSelectedIngredientId(catData[0].id);
        setAddUnit(catData[0].default_unit);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const needsConfirmationCount = items.filter((i) => i.status === 'needs_confirmation' || i.quantity === null).length;
  const inStockCount = items.filter((i) => i.status === 'in_stock').length;
  const outCount = items.filter((i) => i.status === 'out').length;
  const staplesCount = items.filter((i) => i.is_staple).length;

  const filteredItems = items.filter((i) => {
    // Zone filter
    if (storageZoneFilter === 'staples') {
      if (!i.is_staple) return false;
    } else if (storageZoneFilter !== 'all') {
      if ((i.storage_zone || 'fridge') !== storageZoneFilter) return false;
    }

    // Status filter
    if (filter === 'needs_confirmation') return i.status === 'needs_confirmation' || i.quantity === null;
    if (filter === 'in_stock') return i.status === 'in_stock';
    if (filter === 'out') return i.status === 'out';
    return true;
  });

  const openQuickConfirm = () => {
    const initial: { [id: string]: { quantity: string; unit: string; status: string } } = {};
    items
      .filter((i) => i.status === 'needs_confirmation' || i.quantity === null)
      .forEach((i) => {
        initial[i.id] = {
          quantity: i.quantity !== null ? String(i.quantity) : '',
          unit: i.unit,
          status: 'in_stock',
        };
      });
    setConfirmingItems(initial);
    setShowConfirmModal(true);
  };

  const handleSaveBulkConfirm = async () => {
    const payload = Object.entries(confirmingItems).map(([id, val]) => ({
      id,
      quantity: val.quantity ? parseFloat(val.quantity) : null,
      unit: val.unit,
      status: val.status,
    }));
    try {
      const updated = await api.bulkConfirmPantry(payload);
      setItems(updated);
      setShowConfirmModal(false);
    } catch (err) {
      alert(t('common_error', { err: String(err) }));
    }
  };

  const handleOpenEdit = (item: PantryItem) => {
    setEditingItem(item);
    setEditQty(item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : '');
    setEditUnit(item.unit || 'g');
    setEditStatus(item.status || 'in_stock');
    setEditStorageZone(item.storage_zone || 'fridge');
    setEditFuzzyLevel(item.fuzzy_level || 'full');
    setEditIsStaple(Boolean(item.is_staple));
    setEditPackageSize(item.package_size ? String(item.package_size) : '');
    setEditNotes(item.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      setSavingEdit(true);
      const updated = await api.upsertPantryItem({
        ingredient_id: editingItem.ingredient_id,
        quantity: editQty ? parseFloat(editQty) : null,
        unit: editUnit,
        status: editStatus,
        storage_zone: editStorageZone,
        fuzzy_level: editFuzzyLevel,
        is_staple: editIsStaple,
        package_size: editPackageSize ? parseFloat(editPackageSize) : null,
        notes: editNotes || null,
      });
      setItems(items.map((i) => (i.id === editingItem.id ? updated : i)));
      setEditingItem(null);
    } catch (err) {
      alert(t('common_error', { err: String(err) }));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleMarkAsOut = async () => {
    if (!editingItem) return;
    try {
      setSavingEdit(true);
      const updated = await api.upsertPantryItem({
        ingredient_id: editingItem.ingredient_id,
        quantity: 0,
        unit: editUnit,
        status: 'out',
        storage_zone: editStorageZone,
        fuzzy_level: 'out',
        is_staple: editIsStaple,
        notes: editNotes || null,
      });
      setItems(items.map((i) => (i.id === editingItem.id ? updated : i)));
      setEditingItem(null);
    } catch (err) {
      alert(t('common_error', { err: String(err) }));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleStaple = async (item: PantryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = item.status === 'out' ? 'in_stock' : 'out';
    const nextFuzzy = item.status === 'out' ? 'full' : 'out';
    const nextQty = item.status === 'out' ? (item.quantity && item.quantity > 0 ? item.quantity : 1) : 0;
    try {
      const updated = await api.upsertPantryItem({
        ingredient_id: item.ingredient_id,
        quantity: nextQty,
        unit: item.unit,
        status: nextStatus,
        storage_zone: item.storage_zone || 'pantry',
        fuzzy_level: nextFuzzy,
        is_staple: true,
        notes: item.notes,
      });
      setItems(items.map((i) => (i.id === item.id ? updated : i)));
    } catch (err) {
      alert(t('common_error', { err: String(err) }));
    }
  };

  const handleCycleFuzzy = async (item: PantryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const cycleMap: Record<string, 'full' | 'half' | 'low' | 'almost_empty' | 'out'> = {
      full: 'half',
      half: 'low',
      low: 'almost_empty',
      almost_empty: 'out',
      out: 'full',
    };
    const current = (item.fuzzy_level as any) || 'full';
    const nextFuzzy = cycleMap[current] || 'full';
    const nextStatus = nextFuzzy === 'out' ? 'out' : 'in_stock';
    try {
      const updated = await api.upsertPantryItem({
        ingredient_id: item.ingredient_id,
        quantity: nextFuzzy === 'out' ? 0 : item.quantity,
        unit: item.unit,
        status: nextStatus,
        storage_zone: item.storage_zone,
        fuzzy_level: nextFuzzy,
        is_staple: item.is_staple,
        notes: item.notes,
      });
      setItems(items.map((i) => (i.id === item.id ? updated : i)));
    } catch (err) {
      alert(t('common_error', { err: String(err) }));
    }
  };

  const openLedgerModal = async () => {
    setShowLedgerModal(true);
    setLoadingLedger(true);
    try {
      const txs = await api.getInventoryTransactions();
      setTransactions(txs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLedger(false);
    }
  };

  const handleUndoTx = async (txId: string) => {
    try {
      await api.undoTransaction(txId);
      alert(t('ledger_undo_success'));
      await loadData();
      const txs = await api.getInventoryTransactions();
      setTransactions(txs);
    } catch (err) {
      alert(t('common_error', { err: String(err) }));
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (addMode === 'catalog') {
        if (!selectedIngredientId) {
          alert(t('pantry_select_from_list_error'));
          return;
        }
        await api.upsertPantryItem({
          ingredient_id: selectedIngredientId,
          quantity: addQty ? parseFloat(addQty) : null,
          unit: addUnit,
          status: addStatus,
          storage_zone: addStorageZone,
          fuzzy_level: addFuzzyLevel,
          is_staple: addIsStaple,
          package_size: null,
          notes: addNotes || null,
        });
      } else {
        const trimmed = customName.trim();
        if (!trimmed) {
          alert(t('pantry_enter_custom_name_error'));
          return;
        }
        await api.upsertPantryItem({
          custom_ingredient_name: trimmed,
          category: customCategory,
          quantity: addQty ? parseFloat(addQty) : null,
          unit: addUnit,
          status: addStatus,
          storage_zone: addStorageZone,
          fuzzy_level: addFuzzyLevel,
          is_staple: addIsStaple,
          package_size: null,
          notes: addNotes || null,
        });
      }
      setShowAddModal(false);
      setAddQty('');
      setAddNotes('');
      setCustomName('');
      setCatalogSearch('');
      setAddMode('catalog');
      await loadData();
    } catch (err) {
      alert(t('common_error', { err: String(err) }));
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('pantry_delete_confirm'))) return;
    try {
      await api.deletePantryItem(id);
      setItems(items.filter((i) => i.id !== id));
      if (editingItem?.id === id) setEditingItem(null);
    } catch (err) {
      alert(t('common_error', { err: String(err) }));
    }
  };

  const filteredCatalog = catalog.filter((c) => {
    const q = catalogSearch.toLowerCase().trim();
    if (!q) return true;
    const catLabel = getCategoryLabel(c.category);
    return c.canonical_name.toLowerCase().includes(q) || catLabel.toLowerCase().includes(q);
  });

  const getFuzzyBadge = (lvl?: string | null) => {
    switch (lvl) {
      case 'full':
        return { text: t('fuzzy_full'), color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'half':
        return { text: t('fuzzy_half'), color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'low':
        return { text: t('fuzzy_low'), color: 'bg-orange-50 text-orange-700 border-orange-200' };
      case 'almost_empty':
        return { text: t('fuzzy_almost_empty'), color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'out':
        return { text: t('fuzzy_out'), color: 'bg-slate-100 text-slate-600 border-slate-200' };
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('pantry_title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('pantry_desc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openLedgerModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition"
            title={t('ledger_title')}
          >
            <History className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">{t('ledger_title')}</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            {t('pantry_add_product')}
          </button>
        </div>
      </div>

      {/* Storage Zone Segmented Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStorageZoneFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            storageZoneFilter === 'all'
              ? 'bg-orange-600 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {t('zone_all')} ({items.length})
        </button>
        <button
          onClick={() => setStorageZoneFilter('fridge')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            storageZoneFilter === 'fridge'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {t('zone_fridge')}
        </button>
        <button
          onClick={() => setStorageZoneFilter('freezer')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            storageZoneFilter === 'freezer'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {t('zone_freezer')}
        </button>
        <button
          onClick={() => setStorageZoneFilter('pantry')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            storageZoneFilter === 'pantry'
              ? 'bg-amber-700 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {t('zone_pantry')}
        </button>
        <button
          onClick={() => setStorageZoneFilter('staples')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            storageZoneFilter === 'staples'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {t('zone_staples')} ({staplesCount})
        </button>
      </div>

      {/* Alert for Needs Confirmation */}
      {needsConfirmationCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-medium">
              {t('pantry_confirm_alert', { count: needsConfirmationCount })}
            </span>
          </div>
          <button
            onClick={openQuickConfirm}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
          >
            {t('pantry_quick_confirm')}
          </button>
        </div>
      )}

      {/* Status Filters (All, Needs Check, In Stock, Out of Stock) */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('pantry_filter_all')}
        </button>
        <button
          onClick={() => setFilter('needs_confirmation')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filter === 'needs_confirmation'
              ? 'bg-amber-600 text-white'
              : 'text-amber-700 hover:bg-amber-50'
          }`}
        >
          {t('pantry_filter_needs_check')} ({needsConfirmationCount})
        </button>
        <button
          onClick={() => setFilter('in_stock')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filter === 'in_stock' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          {t('pantry_filter_in_stock')} ({inStockCount})
        </button>
        <button
          onClick={() => setFilter('out')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filter === 'out' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
          }`}
        >
          {t('pantry_filter_out')} ({outCount})
        </button>
      </div>

      {/* Pantry Grid Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          {t('pantry_loading')}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
          {t('pantry_empty_section')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isNeedCheck = item.status === 'needs_confirmation' || item.quantity === null;
            const isOut = item.status === 'out';
            const fuzzyInfo = getFuzzyBadge(item.fuzzy_level);
            const zoneIcon =
              item.storage_zone === 'freezer'
                ? '❄️'
                : item.storage_zone === 'pantry'
                ? '📦'
                : '🧊';

            return (
              <div
                key={item.id}
                onClick={() => handleOpenEdit(item)}
                className={`p-4 rounded-xl border bg-white shadow-sm flex flex-col justify-between transition hover:shadow-md cursor-pointer group ${
                  isOut
                    ? 'border-rose-200 bg-rose-50/20 opacity-80'
                    : isNeedCheck
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-slate-200 hover:border-orange-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-semibold text-slate-800 text-base group-hover:text-orange-600 transition">
                          {item.ingredient?.canonical_name || t('pantry_unknown_product')}
                        </h3>
                        {item.is_staple && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                            🧂 {t('staple_badge')}
                          </span>
                        )}
                      </div>
                      
                      {/* Storage Zone & Fuzzy Badges */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium">
                          {zoneIcon} {item.storage_zone ? t(`storage_zone_${item.storage_zone}` as any) : t('storage_zone_fridge')}
                        </span>

                        {fuzzyInfo && (
                          <button
                            type="button"
                            onClick={(e) => handleCycleFuzzy(item, e)}
                            title="Click to cycle fill level"
                            className={`text-[11px] px-2 py-0.5 rounded-md font-medium border transition hover:opacity-80 ${fuzzyInfo.color}`}
                          >
                            {fuzzyInfo.text}
                          </button>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                        isOut
                          ? 'bg-rose-100 text-rose-800'
                          : isNeedCheck
                          ? 'bg-amber-100 text-amber-800'
                          : item.status === 'in_stock'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {isOut
                        ? t('status_out')
                        : isNeedCheck
                        ? t('status_needs_confirmation')
                        : item.status === 'in_stock'
                        ? t('status_in_stock')
                        : item.status}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">{t('pantry_col_qty')}:</span>
                      <span className={`font-bold ${isOut ? 'text-rose-600' : 'text-slate-800'}`}>
                        {item.quantity !== null ? `${item.quantity} ${item.unit}` : t('pantry_not_specified')}
                      </span>
                    </div>
                    {item.last_confirmed_at && (
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{t('pantry_col_confirmed')}:</span>
                        <span>{new Date(item.last_confirmed_at).toLocaleDateString()}</span>
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{t('pantry_col_category')}: {getCategoryLabel(item.ingredient?.category)}</span>
                  <div className="flex items-center gap-2">
                    {item.is_staple && (
                      <button
                        type="button"
                        onClick={(e) => handleToggleStaple(item, e)}
                        className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                          item.status === 'out'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {item.status === 'out' ? t('staple_mark_in') : t('staple_mark_out')}
                      </button>
                    )}
                    <span className="text-orange-600 font-medium text-[11px] group-hover:underline flex items-center gap-1">
                      <Edit3 className="w-3 h-3" />
                      {t('common_edit')}
                    </span>
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      title={t('common_delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Single Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {editingItem.ingredient?.canonical_name}
                </h2>
                <span className="text-xs text-slate-400 capitalize">
                  {t('pantry_col_category')}: {getCategoryLabel(editingItem.ingredient?.category)}
                </span>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    {t('common_quantity')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder={t('pantry_qty_placeholder')}
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    {t('common_unit')}
                  </label>
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="g">{t('unit_g')}</option>
                    <option value="kg">{t('unit_kg')}</option>
                    <option value="ml">{t('unit_ml')}</option>
                    <option value="l">{t('unit_l')}</option>
                    <option value="tbsp">{t('unit_tbsp')}</option>
                    <option value="tsp">{t('unit_tsp')}</option>
                    <option value="pcs">{t('unit_pcs')}</option>
                    <option value="clove">{t('unit_clove')}</option>
                  </select>
                </div>
              </div>

              {/* Storage Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  {t('storage_zone_label')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['fridge', 'freezer', 'pantry'] as const).map((zone) => (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => setEditStorageZone(zone)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                        editStorageZone === zone
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {zone === 'fridge' ? '🧊 ' + t('storage_zone_fridge') : zone === 'freezer' ? '❄️ ' + t('storage_zone_freezer') : '📦 ' + t('storage_zone_pantry')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fuzzy Level */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  {t('fuzzy_level_label')}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(['full', 'half', 'low', 'almost_empty', 'out'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        setEditFuzzyLevel(lvl);
                        if (lvl === 'out') {
                          setEditStatus('out');
                          setEditQty('0');
                        } else if (editStatus === 'out') {
                          setEditStatus('in_stock');
                        }
                      }}
                      className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold transition border text-center ${
                        editFuzzyLevel === lvl
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t(`fuzzy_${lvl}` as any)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kitchen Staple Checkbox */}
              <div className="flex items-center gap-2 p-2.5 bg-purple-50 rounded-xl border border-purple-100">
                <input
                  type="checkbox"
                  id="edit-is-staple"
                  checked={editIsStaple}
                  onChange={(e) => setEditIsStaple(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                />
                <label htmlFor="edit-is-staple" className="text-xs font-medium text-purple-900 cursor-pointer">
                  <span className="font-bold">🧂 {t('is_staple_label')}:</span> {t('is_staple_desc')}
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  {t('pantry_status_label')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditStatus('in_stock')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      editStatus === 'in_stock'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {t('pantry_status_in_stock_btn')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditStatus('needs_confirmation')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      editStatus === 'needs_confirmation'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    {t('pantry_status_check_btn')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditStatus('low')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      editStatus === 'low'
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {t('pantry_status_low_btn')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditStatus('out');
                      setEditQty('0');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      editStatus === 'out'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    {t('pantry_status_out_btn')}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  {t('pantry_notes_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('pantry_notes_placeholder')}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleMarkAsOut}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline"
                >
                  {t('pantry_mark_out')}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    {t('common_cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    {savingEdit ? t('common_saving') : t('common_save')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">
                {t('pantry_quick_confirm_title')}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {t('pantry_quick_confirm_desc')}
              </p>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 divide-y divide-slate-100">
              {Object.keys(confirmingItems).map((itemId) => {
                const item = items.find((i) => i.id === itemId);
                if (!item) return null;
                const val = confirmingItems[itemId];
                return (
                  <div key={itemId} className="pt-3 first:pt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 text-sm">
                        {item.ingredient?.canonical_name}
                      </p>
                      <span className="text-xs text-slate-400">
                        {t('pantry_base_unit', { unit: item.unit })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder={t('pantry_qty_short_placeholder')}
                        value={val.quantity}
                        onChange={(e) =>
                          setConfirmingItems({
                            ...confirmingItems,
                            [itemId]: { ...val, quantity: e.target.value },
                          })
                        }
                        className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <span className="text-sm text-slate-600 w-10">{val.unit}</span>

                      <select
                        value={val.status}
                        onChange={(e) =>
                          setConfirmingItems({
                            ...confirmingItems,
                            [itemId]: { ...val, status: e.target.value },
                          })
                        }
                        className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="in_stock">{t('status_in_stock')}</option>
                        <option value="low">{t('status_low')}</option>
                        <option value="out">{t('status_out')}</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition"
              >
                {t('common_cancel')}
              </button>
              <button
                onClick={handleSaveBulkConfirm}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition"
              >
                {t('pantry_confirm_all_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-orange-600" />
                {t('pantry_add_product')}
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented Mode Selector: Catalog vs Custom */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAddMode('catalog')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  addMode === 'catalog'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-4 h-4" />
                {t('pantry_add_mode_catalog')}
              </button>
              <button
                type="button"
                onClick={() => setAddMode('custom')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  addMode === 'custom'
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {t('pantry_add_mode_custom')}
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-4">
              {addMode === 'catalog' ? (
                /* Mode 1: Select from list with search */
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-600 uppercase">
                    {t('pantry_catalog_select_label')}
                  </label>
                  
                  {/* Search in catalog */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder={t('pantry_catalog_search')}
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  {filteredCatalog.length > 0 ? (
                    <select
                      value={selectedIngredientId}
                      onChange={(e) => {
                        setSelectedIngredientId(e.target.value);
                        const ing = catalog.find((c) => c.id === e.target.value);
                        if (ing) setAddUnit(ing.default_unit);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {filteredCatalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.canonical_name} ({getCategoryLabel(c.category)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-2">
                      <p>{t('pantry_catalog_not_found', { query: catalogSearch })}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomName(catalogSearch);
                          setAddMode('custom');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t('pantry_create_named_custom_btn', { name: catalogSearch })}
                      </button>
                    </div>
                  )}

                  {/* Quick prompt to create custom if not found */}
                  {filteredCatalog.length > 0 && catalogSearch.trim() && (
                    <p className="text-[11px] text-slate-400">
                      {t('pantry_didnt_find_prompt')}{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setCustomName(catalogSearch);
                          setAddMode('custom');
                        }}
                        className="text-orange-600 font-semibold hover:underline"
                      >
                        {t('pantry_create_named_link', { name: catalogSearch })}
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                /* Mode 2: Add custom product */
                <div className="space-y-3 p-3 bg-orange-50/50 rounded-xl border border-orange-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      {t('pantry_custom_name_label')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t('pantry_custom_name_placeholder')}
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      {t('pantry_category_label')}
                    </label>
                    <select
                      value={customCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomCategory(val);
                        if (CATEGORY_MAP[val]?.defaultUnit) {
                          setAddUnit(CATEGORY_MAP[val].defaultUnit);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {Object.keys(CATEGORY_MAP).map((key) => (
                        <option key={key} value={key}>
                          {getCategoryLabel(key)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    {t('pantry_col_qty')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder={t('pantry_qty_example_placeholder')}
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    {t('common_unit')}
                  </label>
                  <select
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="g">{t('unit_g')}</option>
                    <option value="kg">{t('unit_kg')}</option>
                    <option value="ml">{t('unit_ml')}</option>
                    <option value="l">{t('unit_l')}</option>
                    <option value="tbsp">{t('unit_tbsp')}</option>
                    <option value="tsp">{t('unit_tsp')}</option>
                    <option value="pcs">{t('unit_pcs')}</option>
                    <option value="clove">{t('unit_clove')}</option>
                  </select>
                </div>
              </div>

              {/* Storage Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  {t('storage_zone_label')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['fridge', 'freezer', 'pantry'] as const).map((zone) => (
                    <button
                      key={zone}
                      type="button"
                      onClick={() => setAddStorageZone(zone)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border ${
                        addStorageZone === zone
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {zone === 'fridge' ? '🧊 ' + t('storage_zone_fridge') : zone === 'freezer' ? '❄️ ' + t('storage_zone_freezer') : '📦 ' + t('storage_zone_pantry')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fuzzy Level */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  {t('fuzzy_level_label')}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(['full', 'half', 'low', 'almost_empty', 'out'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        setAddFuzzyLevel(lvl);
                        if (lvl === 'out') {
                          setAddStatus('out');
                          setAddQty('0');
                        } else if (addStatus === 'out') {
                          setAddStatus('in_stock');
                        }
                      }}
                      className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold transition border text-center ${
                        addFuzzyLevel === lvl
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {t(`fuzzy_${lvl}` as any)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kitchen Staple Checkbox */}
              <div className="flex items-center gap-2 p-2.5 bg-purple-50 rounded-xl border border-purple-100">
                <input
                  type="checkbox"
                  id="add-is-staple"
                  checked={addIsStaple}
                  onChange={(e) => setAddIsStaple(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                />
                <label htmlFor="add-is-staple" className="text-xs font-medium text-purple-900 cursor-pointer">
                  <span className="font-bold">🧂 {t('is_staple_label')}:</span> {t('is_staple_desc')}
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  {t('pantry_col_status')}
                </label>
                <select
                  value={addStatus}
                  onChange={(e) => setAddStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="in_stock">{t('status_in_stock')}</option>
                  <option value="low">{t('status_low')}</option>
                  <option value="needs_confirmation">{t('status_needs_confirmation')}</option>
                  <option value="out">{t('status_out')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  {t('pantry_notes_optional_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('pantry_notes_hint_placeholder')}
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  {t('common_cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white shadow-sm transition"
                >
                  {t('common_add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Ledger History Modal */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-orange-600" />
                  {t('ledger_title')}
                </h2>
              </div>
              <button
                onClick={() => setShowLedgerModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {loadingLedger ? (
                <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No stock deductions recorded yet. Cook recipes to see item deductions here!
                </p>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                            tx.reason === 'cooked'
                              ? 'bg-orange-100 text-orange-800'
                              : tx.reason === 'undo'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {tx.reason === 'cooked'
                            ? t('ledger_cooked')
                            : tx.reason === 'undo'
                            ? t('ledger_undo')
                            : t('ledger_manual')}
                        </span>
                        <span className="text-slate-400">
                          {new Date(tx.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 font-semibold text-slate-800">
                        {(() => {
                          const matched = items.find((i) => i.id === tx.inventory_item_id);
                          return matched?.ingredient?.canonical_name ? (
                            <span className="text-orange-600 mr-1.5">{matched.ingredient.canonical_name}:</span>
                          ) : null;
                        })()}
                        {tx.delta_quantity !== null && tx.delta_quantity !== undefined && (
                          <span className={tx.delta_quantity < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            {tx.delta_quantity > 0 ? `+${tx.delta_quantity}` : tx.delta_quantity} {tx.unit || ''}{' '}
                          </span>
                        )}
                        {tx.fuzzy_before && tx.fuzzy_after && (
                          <span className="text-slate-500 font-normal">
                            ({tx.fuzzy_before} → {tx.fuzzy_after})
                          </span>
                        )}
                      </div>
                    </div>

                    {tx.reason === 'cooked' && (
                      <button
                        onClick={() => handleUndoTx(tx.id)}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold flex items-center gap-1 shadow-sm transition"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        {t('ledger_undo_btn')}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setShowLedgerModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition"
              >
                {t('common_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
