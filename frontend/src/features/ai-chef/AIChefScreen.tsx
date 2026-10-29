import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../shared/api';
import { useI18n } from '../../app/I18nContext';
import { PantryItem } from '../../types';
import {
  Sparkles,
  Save,
  RefreshCw,
  ShieldCheck,
  Key,
  CheckCircle,
  ExternalLink,
  Lightbulb,
  Utensils,
  Scale,
  Sliders,
  ChevronDown,
  ChevronUp,
  Check,
  Plus,
  RotateCcw,
  Send,
  X,
  Flame,
  MessageSquare,
  Timer,
  ShoppingCart,
} from 'lucide-react';

interface AIChefScreenProps {
  onRecipeSaved: () => void;
}

export const AIChefScreen: React.FC<AIChefScreenProps> = ({ onRecipeSaved }) => {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [satietyLevel, setSatietyLevel] = useState<'light' | 'standard' | 'hearty'>('standard');

  // Gemini API Key Status & Config
  const [aiStatus, setAiStatus] = useState<{ has_gemini_key: boolean; model: string; provider: string } | null>(null);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [configuringKey, setConfiguringKey] = useState(false);

  // Extended Request State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [marinateMeat, setMarinateMeat] = useState(false);
  const [marinateDuration, setMarinateDuration] = useState<number>(30);
  const [mustUseIngredients, setMustUseIngredients] = useState<string[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);

  // Refine & History State
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [refining, setRefining] = useState(false);
  const [recipeHistory, setRecipeHistory] = useState<any[]>([]);

  // Manual Add Ingredient Modal State
  const [showAddIngModal, setShowAddIngModal] = useState(false);
  const [newIngName, setNewIngName] = useState('');
  const [newIngQty, setNewIngQty] = useState<string>('');
  const [newIngUnit, setNewIngUnit] = useState('g');
  const [addedToCartMap, setAddedToCartMap] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleAddSingleItemToCart = async (ingName: string, qty?: any, unit?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const numQty = typeof qty === 'number' ? qty : parseFloat(qty) || null;
      await api.addShoppingItem({
        item_name: ingName,
        quantity: numQty,
        unit: unit,
      });
      setAddedToCartMap((prev) => ({ ...prev, [ingName]: true }));
      setToastMessage(t('recipes_cart_single_added', { name: ingName }));
      setTimeout(() => {
        setAddedToCartMap((prev) => ({ ...prev, [ingName]: false }));
        setToastMessage(null);
      }, 2500);
    } catch (err) {
      alert(t('common_error', { err: String(err) }));
    }
  };

  useEffect(() => {
    loadAIStatus();
    loadPantry();
  }, []);

  const loadAIStatus = async () => {
    try {
      const status = await api.getAIStatus();
      setAiStatus(status);
    } catch (err) {
      console.error('Error fetching AI status:', err);
    }
  };

  const loadPantry = async () => {
    try {
      const items = await api.getPantry();
      setPantryItems(items);
    } catch (err) {
      console.error('Error fetching pantry items for AI chef:', err);
    }
  };

  const availableFridgeItems = useMemo(() => {
    const names = new Set<string>();
    const list: string[] = [];
    pantryItems.forEach((p) => {
      if (p.status !== 'out') {
        const n = p.ingredient?.canonical_name;
        if (n && !names.has(n)) {
          names.add(n);
          list.push(n);
        }
      }
    });
    return list;
  }, [pantryItems]);

  const toggleMustUseIngredient = (name: string) => {
    setMustUseIngredients((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    try {
      setConfiguringKey(true);
      const res = await api.configureGeminiKey(apiKeyInput.trim());
      alert(res.message);
      setApiKeyInput('');
      setShowKeyConfig(false);
      await loadAIStatus();
    } catch (err: any) {
      alert(t('common_error', { err: err?.message || String(err) }));
    } finally {
      setConfiguringKey(false);
    }
  };

  const handleGenerate = async (presetPrompt?: string) => {
    const text = presetPrompt || prompt;
    try {
      setLoading(true);
      setGeneratedRecipe(null);
      setRecipeHistory([]);
      const recipe = await api.generateAIRecipe({
        prompt: text,
        satiety_level: satietyLevel,
        marinate_meat: marinateMeat,
        marinate_duration_minutes: marinateMeat ? marinateDuration : null,
        must_use_ingredients: mustUseIngredients.length > 0 ? mustUseIngredients : undefined,
      });
      setGeneratedRecipe(recipe);
    } catch (err: any) {
      alert(t('common_error', { err: err?.message || String(err) }));
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async (customPrompt?: string) => {
    const text = (customPrompt || refinementPrompt).trim();
    if (!text || !generatedRecipe) return;
    try {
      setRefining(true);
      setRecipeHistory((prev) => [...prev, generatedRecipe]);
      const updated = await api.refineAIRecipe(generatedRecipe, text);
      setGeneratedRecipe(updated);
      setRefinementPrompt('');
    } catch (err: any) {
      alert(t('common_error', { err: err?.message || String(err) }));
    } finally {
      setRefining(false);
    }
  };

  const handleRevert = () => {
    if (recipeHistory.length === 0) return;
    const prev = recipeHistory[recipeHistory.length - 1];
    setRecipeHistory((prevList) => prevList.slice(0, -1));
    setGeneratedRecipe(prev);
  };

  const handleAddCustomIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIngName.trim() || !generatedRecipe) return;
    const newIng = {
      name: newIngName.trim(),
      quantity: newIngQty ? parseFloat(newIngQty) : 100,
      unit: newIngUnit || 'g',
      role: 'required',
      preparation_note: 'добавлено вручную',
      availability: 'in_stock',
      scalable: true,
    };
    setRecipeHistory((prev) => [...prev, generatedRecipe]);
    setGeneratedRecipe({
      ...generatedRecipe,
      ingredients: [...(generatedRecipe.ingredients || []), newIng],
      steps: [
        ...(generatedRecipe.steps || []),
        {
          step_number: (generatedRecipe.steps?.length || 0) + 1,
          instruction: `Добавление ${newIngName.trim().toLowerCase()}: подготовьте и введите в блюдо по вкусу.`,
          duration_seconds: 60,
        },
      ],
      why_this_recipe: (generatedRecipe.why_this_recipe ? generatedRecipe.why_this_recipe + '. ' : '') + `Добавлен ингредиент: ${newIngName.trim()}`,
    });
    setNewIngName('');
    setNewIngQty('');
    setShowAddIngModal(false);
  };

  const handleSaveToRecipes = async () => {
    if (!generatedRecipe) return;
    try {
      setSaving(true);
      await api.saveGeneratedRecipe(generatedRecipe);
      alert(t('ai_recipe_saved_alert'));
      onRecipeSaved();
    } catch (err: any) {
      alert(t('common_error', { err: err?.message || String(err) }));
    } finally {
      setSaving(false);
    }
  };

  const activeAdvancedCount = (marinateMeat ? 1 : 0) + (mustUseIngredients.length > 0 ? 1 : 0);


  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            {aiStatus?.has_gemini_key ? t('ai_online_badge') : t('ai_offline_badge')}
          </div>
          <h1 className="text-3xl font-black tracking-tight">{t('ai_title')}</h1>
          <p className="text-sm text-orange-100 leading-relaxed">
            {t('ai_banner_desc')}
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => handleGenerate(t('ai_prompt_quick_dinner_text'))}
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-xs font-medium border border-white/20 transition"
            >
              {t('ai_preset_quick_dinner')}
            </button>
            <button
              onClick={() => handleGenerate(t('ai_prompt_sweet_sour_text'))}
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-xs font-medium border border-white/20 transition"
            >
              {t('ai_preset_sweet_sour')}
            </button>
            <button
              onClick={() => handleGenerate(t('ai_prompt_pork_goulash_text'))}
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-xs font-medium border border-white/20 transition"
            >
              {t('ai_preset_pork_goulash')}
            </button>
          </div>
        </div>
      </div>

      {/* Gemini API Key Configuration Section */}
      {aiStatus && !aiStatus.has_gemini_key && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <Key className="w-4 h-4 text-amber-600" />
                <span>{t('ai_key_missing_title')}</span>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed max-w-2xl">
                {t('ai_key_missing_desc')}
              </p>
            </div>
            <button
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex-shrink-0"
            >
              {showKeyConfig ? t('ai_btn_hide_key') : t('ai_btn_connect_key')}
            </button>
          </div>

          {showKeyConfig && (
            <form onSubmit={handleSaveKey} className="mt-4 pt-4 border-t border-amber-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  placeholder={t('ai_key_input_placeholder')}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="submit"
                  disabled={configuringKey || !apiKeyInput.trim()}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 shadow-sm"
                >
                  {configuringKey ? t('ai_key_verifying') : t('ai_key_save_activate')}
                </button>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-amber-700">
                <span>{t('ai_key_free_notice')}</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-orange-700 hover:underline inline-flex items-center gap-1"
                >
                  aistudio.google.com <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Prompt Form */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <label className="block text-xs font-semibold text-slate-700 uppercase">
          {t('ai_prompt_label')}
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder={t('ai_prompt_placeholder')}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={() => handleGenerate()}
            disabled={loading}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? t('common_loading') : t('ai_generate_btn')}
          </button>
        </div>

        {/* Satiety Level Selector */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-orange-600" />
            <span className="text-xs font-semibold text-slate-700">{t('ai_satiety_label')}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSatietyLevel('light')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                satietyLevel === 'light'
                  ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('ai_satiety_light')}
            </button>
            <button
              type="button"
              onClick={() => setSatietyLevel('standard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                satietyLevel === 'standard'
                  ? 'bg-orange-100 border-orange-400 text-orange-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('ai_satiety_standard')}
            </button>
            <button
              type="button"
              onClick={() => setSatietyLevel('hearty')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                satietyLevel === 'hearty'
                  ? 'bg-rose-100 border-rose-400 text-rose-900 shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t('ai_satiety_hearty')}
            </button>
          </div>
        </div>

        {/* Advanced Options Toggle Button */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-slate-50 transition text-xs font-bold text-slate-700"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-orange-600" />
              <span>{showAdvanced ? t('ai_advanced_hide') : t('ai_advanced_toggle')}</span>
              {activeAdvancedCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold">
                  {activeAdvancedCount} активн.
                </span>
              )}
            </div>
            {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Advanced Accordion Content */}
          {showAdvanced && (
            <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4 animate-fadeIn">
              {/* Option 1: Marination */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-800">{t('ai_marinate_title')}</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marinateMeat}
                      onChange={(e) => setMarinateMeat(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>

                {marinateMeat && (
                  <div className="pl-6 space-y-1.5 animate-fadeIn">
                    <span className="block text-[11px] font-medium text-slate-500">
                      {t('ai_marinate_time_label')}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { min: 15, label: t('ai_marinate_15m') },
                        { min: 30, label: t('ai_marinate_30m') },
                        { min: 60, label: t('ai_marinate_60m') },
                        { min: 120, label: t('ai_marinate_120m') },
                      ].map((dur) => (
                        <button
                          key={dur.min}
                          type="button"
                          onClick={() => setMarinateDuration(dur.min)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition border ${
                            marinateDuration === dur.min
                              ? 'bg-orange-600 text-white border-orange-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {dur.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Option 2: Must-use ingredients from pantry */}
              <div className="space-y-2 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">{t('ai_must_use_title')}</span>
                  </div>
                  {mustUseIngredients.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMustUseIngredients([])}
                      className="text-[11px] text-orange-600 hover:underline font-semibold"
                    >
                      {t('ai_must_use_clear')} ({mustUseIngredients.length})
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500">
                  {t('ai_must_use_hint')}
                </p>

                {availableFridgeItems.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200/70">
                    {availableFridgeItems.map((name) => {
                      const isSelected = mustUseIngredients.includes(name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleMustUseIngredient(name)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition border ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                          <span>{name}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200">
                    {t('ai_must_use_empty_pantry')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{t('ai_safety_notice')}</span>
        </div>
      </div>

      {/* Generated Result Preview */}
      {loading && (
        <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
          <p className="text-sm font-medium text-slate-600">{t('ai_generating')}</p>
        </div>
      )}

      {generatedRecipe && (
        <div className="bg-white rounded-3xl border border-orange-200 shadow-lg p-6 sm:p-8 space-y-6 animate-fadeIn">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800">
                  {generatedRecipe.cuisine || t('ai_title')}
                </span>
                <span className="text-xs text-slate-400">
                  {t('common_minutes', { count: generatedRecipe.duration_minutes || 30 })} • {t(('common_difficulty_' + (generatedRecipe.difficulty || 'medium')) as any) || generatedRecipe.difficulty}
                </span>

                {generatedRecipe.generator === 'gemini' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    {t('ai_gemini_response_badge')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    {t('ai_mock_response_badge')}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-black text-slate-800">{generatedRecipe.title}</h2>
              <p className="text-xs text-slate-500 mt-1">{generatedRecipe.description}</p>

              {generatedRecipe.fallback_reason && (
                <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
                  {t('ai_fallback_notice')}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleSaveToRecipes}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold transition shadow-md disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? t('ai_saving') : t('ai_save_recipe')}
              </button>
            </div>
          </div>

          {/* Why This Recipe Box */}
          {generatedRecipe.why_this_recipe && (
            <div className="bg-orange-50/70 border border-orange-200 p-4 rounded-2xl text-xs text-orange-950 flex items-start gap-2.5">
              <Lightbulb className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{t('ai_why_title')} </span>
                <span>{generatedRecipe.why_this_recipe}</span>
              </div>
            </div>
          )}

          {/* KBJU Nutritional Target Cards */}
          {generatedRecipe.macros_per_serving && (
            <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-2">
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {t('ai_macros_title')}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                  <span className="block text-xl font-black text-slate-800">
                    {generatedRecipe.macros_per_serving.kcal}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">{t('ai_macros_kcal')}</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                  <span className="block text-xl font-black text-orange-600">
                    {generatedRecipe.macros_per_serving.protein_g}g
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">{t('ai_macros_protein')}</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                  <span className="block text-xl font-black text-amber-600">
                    {generatedRecipe.macros_per_serving.fat_g}g
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">{t('ai_macros_fat')}</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs">
                  <span className="block text-xl font-black text-emerald-600">
                    {generatedRecipe.macros_per_serving.carbs_g}g
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">{t('ai_macros_carbs')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Equipment used */}
          {generatedRecipe.equipment_used && generatedRecipe.equipment_used.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
              <Utensils className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="font-bold">{t('ai_equipment_title')}:</span>
              <div className="flex flex-wrap gap-1.5">
                {generatedRecipe.equipment_used.map((eq: string, idx: number) => (
                  <span key={idx} className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 font-medium">
                    {eq}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ingredients Breakdown with Dedicated Blocks */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">
              {t('ai_ingredients_header', { servings: generatedRecipe.base_servings || 1 })}
            </h4>

            {(() => {
              const marinadeIngs = generatedRecipe.ingredients.filter((i: any) => i.role === 'marinade');
              const sauceIngs = generatedRecipe.ingredients.filter((i: any) => i.role === 'main_sauce');
              const baseIngs = generatedRecipe.ingredients.filter(
                (i: any) => i.role !== 'marinade' && i.role !== 'main_sauce'
              );

              const renderIngItem = (ing: any, idx: number) => {
                const isToBuy = ing.availability === 'to_buy';
                const isStaple = ing.availability === 'staple';
                const isMarinade = ing.role === 'marinade';
                const isSauce = ing.role === 'main_sauce';
                const isAdded = addedToCartMap[ing.name];

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                      isMarinade
                        ? 'bg-amber-50/70 border-amber-300 text-amber-950 font-medium'
                        : isSauce
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-medium'
                        : isToBuy
                        ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                        : isStaple
                        ? 'bg-amber-50/40 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-medium flex items-center gap-1.5 flex-wrap">
                        <span>{ing.name}</span>
                        {isMarinade && (
                          <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-bold rounded">
                            🥩 {t('recipes_marinade_block')}
                          </span>
                        )}
                        {isSauce && (
                          <span className="px-1.5 py-0.5 bg-indigo-200 text-indigo-800 text-[10px] font-bold rounded">
                            🥣 {t('recipes_sauce_block')}
                          </span>
                        )}
                        {isToBuy && (
                          <span className="px-1.5 py-0.5 bg-rose-200 text-rose-800 text-[10px] font-bold rounded">
                            🛒 {t('status_to_buy') || 'в покупки'}
                          </span>
                        )}
                        {isStaple && (
                          <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-bold rounded">
                            🧂 {t('is_staple_label') || 'база'}
                          </span>
                        )}
                      </div>
                      {ing.preparation_note && (
                        <p className="text-[11px] text-slate-400 italic">{ing.preparation_note}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="font-bold text-orange-600 whitespace-nowrap">
                        {ing.quantity} {ing.unit}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleAddSingleItemToCart(ing.name, ing.quantity, ing.unit, e)}
                        className={`p-1.5 rounded-lg border transition ${
                          isAdded
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-600'
                            : 'bg-white border-slate-200 text-slate-400 hover:text-orange-600 hover:border-orange-300'
                        }`}
                        title={t('recipes_cart_single_added', { name: ing.name })}
                      >
                        {isAdded ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-4">
                  {/* Dedicated Marinade Block - ONLY if role === 'marinade' exists */}
                  {marinadeIngs.length > 0 && (
                    <div className="border border-amber-300/80 bg-amber-50/40 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center gap-2 pb-1 border-b border-amber-200/70">
                        <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                          {t('recipes_marinade_block')}
                        </span>
                        <span className="text-[10px] text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded-full font-medium">
                          {marinadeIngs.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {marinadeIngs.map((ing: any, idx: number) => renderIngItem(ing, idx))}
                      </div>
                    </div>
                  )}

                  {/* Dedicated Sauce Block - ONLY if role === 'main_sauce' exists */}
                  {sauceIngs.length > 0 && (
                    <div className="border border-indigo-200 bg-indigo-50/40 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center gap-2 pb-1 border-b border-indigo-200/70">
                        <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                          {t('recipes_sauce_block')}
                        </span>
                        <span className="text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full font-medium">
                          {sauceIngs.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {sauceIngs.map((ing: any, idx: number) => renderIngItem(ing, idx))}
                      </div>
                    </div>
                  )}

                  {/* Base Ingredients Block */}
                  {baseIngs.length > 0 && (
                    <div className="space-y-2">
                      {(marinadeIngs.length > 0 || sauceIngs.length > 0) && (
                        <div className="flex items-center gap-2 pb-1">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                            {t('recipes_base_block')}
                          </span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                            {baseIngs.length}
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {baseIngs.map((ing: any, idx: number) => renderIngItem(ing, idx))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Steps */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
              {t('ai_instructions_header')}
            </h4>
            <div className="space-y-3">
              {generatedRecipe.steps.map((st: any) => {
                const isMarinadeStep = st.instruction?.toLowerCase().includes('марин');
                return (
                  <div
                    key={st.step_number}
                    className={`p-4 rounded-xl flex gap-3 text-xs border ${
                      isMarinadeStep ? 'bg-orange-50/50 border-orange-200' : 'bg-slate-50 border-slate-100'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 flex-shrink-0 text-white rounded-full font-bold flex items-center justify-center text-xs ${
                        isMarinadeStep ? 'bg-amber-600' : 'bg-orange-600'
                      }`}
                    >
                      {st.step_number}
                    </span>
                    <div>
                      <p className="text-slate-800 leading-relaxed font-medium">{st.instruction}</p>
                      {st.duration_seconds && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[11px] text-slate-500 font-semibold">
                          <Timer className="w-3 h-3 text-slate-400" />
                          <span>~{t('common_minutes', { count: Math.round(st.duration_seconds / 60) })}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Refine & Adjust Card (Placed at the bottom of the recipe) */}
          <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/70 border border-orange-200/90 rounded-2xl p-5 space-y-3.5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-orange-950 font-bold text-sm">
                <MessageSquare className="w-4 h-4 text-orange-600" />
                <span>{t('ai_refine_title')}</span>
              </div>
              {recipeHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleRevert}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-orange-600 font-semibold transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
                  <span>{t('ai_refine_revert')} ({recipeHistory.length})</span>
                </button>
              )}
            </div>

            <p className="text-xs text-slate-600">
              {t('ai_refine_subtitle')}
            </p>

            {/* Quick Suggestion Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: t('ai_refine_chip_less_salt'), prompt: 'хочу меньше солености' },
                { label: t('ai_refine_chip_more_sauce'), prompt: 'хочу больше соуса, чтобы пропитывал лапшу' },
                { label: t('ai_refine_chip_sweeter'), prompt: 'сделай соус более сладковатым' },
                { label: t('ai_refine_chip_spicy'), prompt: 'добавь пикантности и умеренной остроты' },
                { label: t('ai_refine_chip_faster'), prompt: 'упрости и сократи время приготовления' },
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={refining}
                  onClick={() => handleRefine(chip.prompt)}
                  className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white border border-orange-200 text-slate-700 text-xs font-medium transition shadow-2xs hover:border-orange-300 disabled:opacity-50"
                >
                  {chip.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setShowAddIngModal(true)}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold transition flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('ai_refine_add_ingredient_btn')}</span>
              </button>
            </div>

            {/* Text Input Row */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder={t('ai_refine_placeholder')}
                value={refinementPrompt}
                onChange={(e) => setRefinementPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                disabled={refining}
                className="flex-1 px-4 py-2.5 bg-white border border-orange-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => handleRefine()}
                disabled={refining || !refinementPrompt.trim()}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 flex-shrink-0"
              >
                {refining ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {refining ? t('ai_refine_loading') : t('ai_refine_submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Custom Ingredient Modal */}
      {showAddIngModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddIngModal(false);
          }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>{t('ai_refine_add_ing_title')}</span>
              </h3>
              <button
                onClick={() => setShowAddIngModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomIngredient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('ai_refine_add_ing_name')} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Болгарский перец или Грибы шампиньоны"
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('ai_refine_add_ing_qty')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="100"
                    value={newIngQty}
                    onChange={(e) => setNewIngQty(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {t('ai_refine_add_ing_unit')}
                  </label>
                  <select
                    value={newIngUnit}
                    onChange={(e) => setNewIngUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="g">г (g)</option>
                    <option value="ml">мл (ml)</option>
                    <option value="pcs">шт (pcs)</option>
                    <option value="tbsp">ст. л. (tbsp)</option>
                    <option value="tsp">ч. л. (tsp)</option>
                    <option value="clove">зубчик (clove)</option>
                    <option value="pinch">щепотка (pinch)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddIngModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  {t('common_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newIngName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
                >
                  {t('ai_refine_add_ing_confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-1 ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

