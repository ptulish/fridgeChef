import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import { useI18n } from '../../app/I18nContext';
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
  Scale
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

  useEffect(() => {
    loadAIStatus();
  }, []);

  const loadAIStatus = async () => {
    try {
      const status = await api.getAIStatus();
      setAiStatus(status);
    } catch (err) {
      console.error('Error fetching AI status:', err);
    }
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
      const recipe = await api.generateAIRecipe({
        prompt: text,
        satiety_level: satietyLevel,
      });
      setGeneratedRecipe(recipe);
    } catch (err: any) {
      alert(t('common_error', { err: err?.message || String(err) }));
    } finally {
      setLoading(false);
    }
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

            <button
              onClick={handleSaveToRecipes}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-bold transition shadow-md flex-shrink-0"
            >
              <Save className="w-4 h-4" />
              {saving ? t('ai_saving') : t('ai_save_recipe')}
            </button>
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

          {/* Ingredients Breakdown */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
              {t('ai_ingredients_header', { servings: generatedRecipe.base_servings || 1 })}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {generatedRecipe.ingredients.map((ing: any, idx: number) => {
                const isToBuy = ing.availability === 'to_buy';
                const isStaple = ing.availability === 'staple';

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                      isToBuy
                        ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                        : isStaple
                        ? 'bg-amber-50/40 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-medium flex items-center gap-1.5">
                        <span>{ing.name}</span>
                        {isToBuy && (
                          <span className="px-1.5 py-0.5 bg-rose-200 text-rose-800 text-[10px] font-bold rounded">
                            🛒 в покупки
                          </span>
                        )}
                        {isStaple && (
                          <span className="px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[10px] font-bold rounded">
                            🧂 база
                          </span>
                        )}
                      </div>
                      {ing.preparation_note && (
                        <p className="text-[11px] text-slate-400 italic">{ing.preparation_note}</p>
                      )}
                    </div>
                    <span className="font-bold text-orange-600 flex-shrink-0 ml-2">
                      {ing.quantity} {ing.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Steps */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
              {t('ai_instructions_header')}
            </h4>
            <div className="space-y-3">
              {generatedRecipe.steps.map((st: any) => (
                <div key={st.step_number} className="p-4 bg-slate-50 rounded-xl flex gap-3 text-xs">
                  <span className="w-6 h-6 flex-shrink-0 bg-orange-600 text-white rounded-full font-bold flex items-center justify-center text-xs">
                    {st.step_number}
                  </span>
                  <div>
                    <p className="text-slate-800 leading-relaxed font-medium">{st.instruction}</p>
                    {st.duration_seconds && (
                      <span className="inline-block mt-1 text-[11px] text-slate-400">
                        ⏱ ~{t('common_minutes', { count: Math.round(st.duration_seconds / 60) })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
