import React, { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { UserTasteProfile } from '../../types';
import { useI18n } from '../../app/I18nContext';
import {
  UserCheck,
  ShieldAlert,
  Sparkles,
  Utensils,
  Flame,
  Droplets,
  Edit3,
  Check,
  HeartPulse,
  Scale,
  Ban,
  Plus,
  X,
  Award
} from 'lucide-react';

export const TasteProfileScreen: React.FC = () => {
  const { t } = useI18n();
  const [profile, setProfile] = useState<UserTasteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [saltSens, setSaltSens] = useState('high');
  const [sauceVol, setSauceVol] = useState('abundant');
  const [disliked, setDisliked] = useState('');
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'home_cook' | 'advanced' | 'chef'>('home_cook');
  const [activeMode, setActiveMode] = useState('comfort_food');
  const [weightKg, setWeightKg] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [mealsPerDay, setMealsPerDay] = useState<number>(3);
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [allergiesList, setAllergiesList] = useState<string[]>([]);
  const [newAllergyInput, setNewAllergyInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await api.getTasteProfile();
      setProfile(data);
      setSaltSens(data.salt_sensitivity || 'high');
      setSauceVol(data.sauce_preference?.sauce_volume || 'abundant');
      setDisliked(data.disliked_ingredients?.join(', ') || '');
      setSkillLevel(data.skill_level || 'home_cook');
      setActiveMode(data.active_mode || 'comfort_food');
      setWeightKg(data.weight_kg ? String(data.weight_kg) : '');
      setHeightCm(data.height_cm ? String(data.height_cm) : '');
      setMealsPerDay(data.meals_per_day || 3);
      setActivityLevel(data.activity_level || 'moderate');
      setAllergiesList(data.allergies || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleAddAllergy = () => {
    const val = newAllergyInput.trim();
    if (val && !allergiesList.includes(val)) {
      setAllergiesList([...allergiesList, val]);
      setNewAllergyInput('');
    }
  };

  const handleRemoveAllergy = (toRemove: string) => {
    setAllergiesList(allergiesList.filter((a) => a !== toRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await api.updateTasteProfile({
        salt_sensitivity: saltSens,
        sauce_preference: {
          ...profile?.sauce_preference,
          sauce_volume: sauceVol,
        },
        disliked_ingredients: disliked.split(',').map((s) => s.trim()).filter(Boolean),
        skill_level: skillLevel,
        active_mode: activeMode,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        meals_per_day: mealsPerDay,
        activity_level: activityLevel,
        allergies: allergiesList,
      });
      setProfile(updated);
      setIsEditing(false);
    } catch (err: any) {
      alert(t('common_error', { err: err?.message || String(err) }));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return <div className="p-12 text-center text-slate-400">{t('profile_loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-5 h-5 text-orange-600" />
            <h1 className="text-2xl font-bold text-slate-800">{t('profile_title')}</h1>
          </div>
          <p className="text-sm text-slate-500">{t('profile_desc')}</p>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition"
        >
          <Edit3 className="w-4 h-4" />
          {isEditing ? t('profile_close_edit') : t('profile_edit')}
        </button>
      </div>

      {/* Editing Form */}
      {isEditing && (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-orange-200 shadow-xl space-y-6 animate-fadeIn">
          <h3 className="font-bold text-slate-800 text-lg border-b border-slate-100 pb-3">
            {t('profile_edit_title')}
          </h3>

          {/* Body stats & portions */}
          <div className="space-y-3 bg-amber-50/50 p-5 rounded-2xl border border-amber-200/60">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <Scale className="w-4 h-4 text-amber-600" />
              <span>{t('profile_body_stats_title')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t('profile_weight_label')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="75"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t('profile_height_label')}
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="180"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t('profile_meals_label')}
                </label>
                <select
                  value={mealsPerDay}
                  onChange={(e) => setMealsPerDay(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t('profile_activity_label')}
                </label>
                <select
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="sedentary">{t('profile_activity_sedentary')}</option>
                  <option value="light">{t('profile_activity_light')}</option>
                  <option value="moderate">{t('profile_activity_moderate')}</option>
                  <option value="active">{t('profile_activity_active')}</option>
                  <option value="very_active">{t('profile_activity_very_active')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Skill & Diet Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('profile_skill_label')}
              </label>
              <select
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="beginner">{t('profile_skill_beginner')}</option>
                <option value="home_cook">{t('profile_skill_home_cook')}</option>
                <option value="advanced">{t('profile_skill_advanced')}</option>
                <option value="chef">{t('profile_skill_chef')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {t('profile_active_mode_label')}
              </label>
              <select
                value={activeMode}
                onChange={(e) => setActiveMode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="comfort_food">{t('profile_mode_comfort')}</option>
                <option value="quick_15">{t('profile_mode_quick')}</option>
                <option value="high_protein">{t('profile_mode_protein')}</option>
                <option value="cheat_meal">{t('profile_mode_cheat')}</option>
              </select>
            </div>
          </div>

          {/* Strict Allergies */}
          <div className="space-y-2 bg-rose-50/40 p-4 rounded-2xl border border-rose-200/50">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase">
              <Ban className="w-4 h-4 text-rose-600" />
              <span>{t('profile_allergies_label')}</span>
            </div>
            <p className="text-xs text-rose-600">{t('profile_allergies_desc')}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {allergiesList.map((alg) => (
                <span
                  key={alg}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 rounded-xl text-xs font-semibold"
                >
                  {alg}
                  <button
                    type="button"
                    onClick={() => handleRemoveAllergy(alg)}
                    className="hover:text-rose-950"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Добавить аллерген..."
                value={newAllergyInput}
                onChange={(e) => setNewAllergyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAllergy();
                  }
                }}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                type="button"
                onClick={handleAddAllergy}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> {t('shopping_add_item')}
              </button>
            </div>
          </div>

          {/* Flavor Preferences */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                {t('profile_salt_sensitivity')}
              </label>
              <select
                value={saltSens}
                onChange={(e) => setSaltSens(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="high">{t('profile_salt_option_high')}</option>
                <option value="normal">{t('profile_salt_option_normal')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                {t('profile_sauce_volume_label')}
              </label>
              <select
                value={sauceVol}
                onChange={(e) => setSauceVol(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="abundant">{t('profile_sauce_option_abundant')}</option>
                <option value="extra_abundant">{t('profile_sauce_option_extra')}</option>
                <option value="moderate">{t('profile_sauce_option_moderate')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
              {t('profile_disliked_label')}
            </label>
            <input
              type="text"
              value={disliked}
              onChange={(e) => setDisliked(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {t('common_cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
            >
              {saving ? t('common_saving') : t('profile_save_changes')}
            </button>
          </div>
        </form>
      )}

      {/* Target Portions & Calories Summary Bar */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-amber-600 text-white p-6 rounded-3xl shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-white/90" />
            <h2 className="font-extrabold text-lg tracking-tight">{t('profile_body_stats_title')}</h2>
          </div>
          <p className="text-xs text-white/80">
            {profile.weight_kg && profile.height_cm
              ? `${profile.weight_kg} kg • ${profile.height_cm} cm • ${profile.meals_per_day || 3} meals/day`
              : 'Укажите вес и рост в настройках для авто-расчета порций'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {profile.computed_daily_kcal ? (
            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
              <span className="block text-[10px] uppercase font-bold text-white/80">Суточная норма</span>
              <span className="text-base font-black">~{profile.computed_daily_kcal} ккал</span>
            </div>
          ) : null}

          {profile.target_meal_kcal ? (
            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
              <span className="block text-[10px] uppercase font-bold text-white/80">Порция на 1 приём</span>
              <span className="text-base font-black">~{profile.target_meal_kcal} ккал</span>
            </div>
          ) : null}

          <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 flex items-center gap-2">
            <Award className="w-4 h-4 text-white" />
            <div>
              <span className="block text-[10px] uppercase font-bold text-white/80">Кулинарный скилл</span>
              <span className="text-xs font-bold capitalize">{profile.skill_level || 'home_cook'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Visual Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Salt & Seasoning Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-rose-600">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
              {t('profile_salt_sensitivity')}
            </h3>
          </div>
          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
            {profile.salt_sensitivity === 'high' ? t('profile_salt_high') : t('profile_salt_normal')}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
            {profile.habits?.salt_rule || t('profile_salt_option_high')}
          </p>
        </div>

        {/* Sauce Preferences Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-orange-600">
            <Droplets className="w-5 h-5" />
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
              {t('profile_sauce_pref')}
            </h3>
          </div>
          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
            {t('profile_sauce_abundant')}
          </div>
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
            {t('profile_sauce_rule_desc')}
          </p>
        </div>

        {/* Strict Allergies & Dislikes */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-600">
            <Flame className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
              {t('profile_allergies_label')}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.allergies && profile.allergies.length > 0 ? (
              profile.allergies.map((alg, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-rose-50 text-rose-700 font-bold rounded-lg text-xs border border-rose-200"
                >
                  🚫 {alg}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">Аллергий не указано</span>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <span className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">{t('profile_disliked')}</span>
            <div className="flex flex-wrap gap-1.5">
              {profile.disliked_ingredients.map((item, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Equipment and Habits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-700">
            <Utensils className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
              {t('profile_equipment')}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {profile.equipment.map((eq, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-800 font-semibold rounded-xl text-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 text-orange-600" />
                {eq}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-700">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
              {t('profile_meats')}
            </h3>
          </div>
          <div className="text-xs text-slate-600 space-y-1">
            <p>{t('profile_meat_beef_pork')}</p>
            <p>{t('profile_meat_chicken')}</p>
            <p>{t('profile_meat_sausages')}</p>
            <p>{t('profile_meat_portion_desc')}</p>
          </div>
        </div>
      </div>

      {/* Live AI Context Preview */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-400">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-bold text-sm uppercase tracking-wider">
              {t('profile_ai_context')}
            </h3>
          </div>
          <span className="text-[11px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full">
            {t('profile_updated_at', { date: new Date(profile.updated_at).toLocaleString() })}
          </span>
        </div>

        <pre className="text-xs text-slate-300 font-mono bg-slate-950 p-4 rounded-xl whitespace-pre-wrap leading-relaxed border border-slate-800">
          {profile.ai_profile_summary}
        </pre>
      </div>
    </div>
  );
};
