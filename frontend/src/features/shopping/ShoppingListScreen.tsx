import React, { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { ShoppingList, Ingredient } from '../../types';
import { useI18n } from '../../app/I18nContext';
import { ShoppingCart, Check, Trash2, Plus } from 'lucide-react';

export const ShoppingListScreen: React.FC = () => {
  const { t } = useI18n();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [catalog, setCatalog] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Item
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('g');
  const [showAddForm, setShowAddForm] = useState(false);

  const loadList = async () => {
    try {
      setLoading(true);
      const [data, catData] = await Promise.all([
        api.getShoppingList(),
        api.getCanonicalIngredients(),
      ]);
      setList(data);
      setCatalog(catData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleToggle = async (id: string) => {
    try {
      const updatedItem = await api.toggleShoppingItem(id);
      if (list) {
        setList({
          ...list,
          items: list.items.map((i) => (i.id === id ? updatedItem : i)),
        });
      }
    } catch (err: any) {
      alert(t('common_error', { err: err?.message || String(err) }));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteShoppingItem(id);
      if (list) {
        setList({
          ...list,
          items: list.items.filter((i) => i.id !== id),
        });
      }
    } catch (err: any) {
      alert(t('common_error', { err: err?.message || String(err) }));
    }
  };

  const handleClearBought = async () => {
    try {
      const updated = await api.clearBoughtItems();
      setList(updated);
    } catch (err: any) {
      alert(t('common_error', { err: err?.message || String(err) }));
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName) return;
    try {
      await api.addShoppingItem({
        item_name: itemName,
        quantity: quantity ? parseFloat(quantity) : null,
        unit: unit,
      });
      setItemName('');
      setQuantity('');
      setShowAddForm(false);
      loadList();
    } catch (err: any) {
      alert(t('common_error', { err: err?.message || String(err) }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="w-5 h-5 text-orange-600" />
            <h1 className="text-2xl font-bold text-slate-800">{t('shopping_title')}</h1>
          </div>
          <p className="text-sm text-slate-500">{t('shopping_desc')}</p>
        </div>
        <div className="flex gap-2">
          {list && list.items.some((i) => i.is_bought) && (
            <button
              onClick={handleClearBought}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition"
            >
              {t('shopping_clear_bought')}
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t('shopping_add_item')}
          </button>
        </div>
      </div>

      {/* Add Item Inline Form */}
      {showAddForm && (
        <form onSubmit={handleAddItem} className="bg-white p-4 rounded-2xl border border-orange-200 shadow-sm flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">{t('shopping_item_name_label')}</label>
            <input
              type="text"
              list="shopping-catalog-list"
              placeholder={t('shopping_item_placeholder')}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <datalist id="shopping-catalog-list">
              {catalog.map((c) => (
                <option key={c.id} value={c.canonical_name}>
                  {c.category}
                </option>
              ))}
            </datalist>
          </div>
          <div className="w-full sm:w-28">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">{t('common_quantity')}</label>
            <input
              type="number"
              step="any"
              placeholder="200"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="w-full sm:w-24">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">{t('common_unit')}</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="g">{t('unit_g')}</option>
              <option value="kg">{t('unit_kg')}</option>
              <option value="ml">{t('unit_ml')}</option>
              <option value="l">{t('unit_l')}</option>
              <option value="pcs">{t('unit_pcs')}</option>
              <option value="tbsp">{t('unit_tbsp')}</option>
              <option value="tsp">{t('unit_tsp')}</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-sm"
          >
            {t('common_add')}
          </button>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">{t('shopping_loading')}</div>
      ) : !list || list.items.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">{t('shopping_empty')}</p>
          <p className="text-xs text-slate-400 mt-1">
            {t('shopping_one_click_desc')}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {list.items.map((item) => (
            <div
              key={item.id}
              className={`p-4 flex items-center justify-between gap-3 transition ${
                item.is_bought ? 'bg-slate-50/70 text-slate-400' : 'hover:bg-slate-50/40 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(item.id)}
                  className={`w-6 h-6 rounded-lg border flex items-center justify-center transition ${
                    item.is_bought
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-slate-300 hover:border-orange-500'
                  }`}
                >
                  {item.is_bought && <Check className="w-4 h-4" />}
                </button>
                <div>
                  <span className={`text-sm font-semibold ${item.is_bought ? 'line-through' : ''}`}>
                    {item.item_name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-600">
                  {item.quantity !== null ? `${item.quantity} ${item.unit}` : item.unit}
                </span>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 text-slate-300 hover:text-rose-600 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
