import React, { useState } from 'react';
import { useI18n } from '../../app/I18nContext';
import { api } from '../../shared/api';
import {
  ChefHat,
  Flame,
  Clock,
  Utensils,
  ShieldAlert,
  Ban,
  Sparkles,
  Activity,
  Target,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  HelpCircle,
  Users,
} from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onSkip }) => {
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [saving, setSaving] = useState<boolean>(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState<boolean>(false);

  // --- Step 1 State: Skills, Time, Servings, Equipment ---
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'home_cook' | 'advanced'>('home_cook');
  const [cookingTime, setCookingTime] = useState<string>('30_45');
  const [servings, setServings] = useState<number>(2);
  const [equipment, setEquipment] = useState<string[]>([
    'Плита и стандартный набор (кастрюля, сковорода)',
    'Духовка',
  ]);

  // --- Step 2 State: Diet, Allergies, Disliked ---
  const [dietType, setDietType] = useState<string>('omnivore');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikedTags, setDislikedTags] = useState<string[]>([]);
  const [dislikedInput, setDislikedInput] = useState<string>('');

  // --- Step 3 State: Cuisines, Spice ---
  const [cuisines, setCuisines] = useState<string[]>([
    'Итальянская и средиземноморская',
    'Домашняя классика / Восточноевропейская',
  ]);
  const [spiceTolerance, setSpiceTolerance] = useState<string>('mild');

  // --- Step 4 State: Activity & Goal ---
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'moderate' | 'active' | 'very_active'>('moderate');
  const [nutritionalGoal, setNutritionalGoal] = useState<string>('tasty_balanced');

  const totalSteps = 4;

  // Toggle helpers
  const toggleEquipment = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const toggleAllergy = (item: string) => {
    if (item === 'none') {
      setAllergies([]);
      return;
    }
    setAllergies((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const toggleCuisine = (item: string) => {
    setCuisines((prev) => {
      if (prev.includes(item)) return prev.filter((i) => i !== item);
      if (prev.length >= 4) return prev; // max 4
      return [...prev, item];
    });
  };

  const handleAddDisliked = (val?: string) => {
    const raw = val !== undefined ? val : dislikedInput;
    if (!raw.trim()) return;
    const splitItems = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && !dislikedTags.includes(s));
    if (splitItems.length > 0) {
      setDislikedTags([...dislikedTags, ...splitItems]);
    }
    setDislikedInput('');
  };

  const handleRemoveDisliked = (tag: string) => {
    setDislikedTags(dislikedTags.filter((t) => t !== tag));
  };

  // Submit survey
  const handleSavePreferences = async (isSkip: boolean = false) => {
    try {
      setSaving(true);

      const finalSkill = isSkip ? 'home_cook' : skillLevel;
      const finalTime = isSkip ? '30–45 минут' : cookingTime === 'under_20' ? 'До 15–20 минут' : cookingTime === '30_45' ? '30–45 минут' : 'Больше часа';
      const finalDiet = isSkip ? 'omnivore' : dietType;
      const finalEquipment = isSkip
        ? ['Плита и стандартный набор (кастрюля, сковорода)', 'Духовка']
        : equipment.length > 0
        ? equipment
        : ['Плита и стандартный набор (кастрюля, сковорода)'];
      const finalAllergies = isSkip ? [] : allergies;
      const finalDisliked = isSkip ? [] : dislikedTags;
      const finalCuisines = isSkip
        ? ['Итальянская и средиземноморская', 'Домашняя классика']
        : cuisines;
      const finalSpice = isSkip
        ? 'легкая пикантность'
        : spiceTolerance === 'none'
        ? 'никакой остроты'
        : spiceTolerance === 'mild'
        ? 'легкая пикантность'
        : 'люблю поострее';
      const finalActivity = isSkip ? 'moderate' : activityLevel;
      const finalGoal = isSkip
        ? 'вкусно и сбалансированно'
        : nutritionalGoal === 'tasty_balanced'
        ? 'вкусно поесть без выбрасывания продуктов'
        : nutritionalGoal === 'high_protein'
        ? 'норма белка и мышечная масса'
        : nutritionalGoal === 'weight_loss'
        ? 'сбросить вес'
        : 'сбалансированное питание';

      await api.updateTasteProfile({
        skill_level: finalSkill,
        equipment: finalEquipment,
        allergies: finalAllergies,
        disliked_ingredients: finalDisliked,
        favorite_cuisines: finalCuisines,
        diet_modes: [finalDiet],
        activity_level: finalActivity,
        habits: {
          diet_type: finalDiet,
          cooking_time_pref: finalTime,
          spice_tolerance: finalSpice,
          nutritional_goal: finalGoal,
          default_servings: isSkip ? 2 : servings,
          onboarding_completed: true,
        },
      });

      if (isSkip && onSkip) {
        onSkip();
      } else {
        onComplete();
      }
    } catch (err) {
      console.error('Error saving onboarding preferences:', err);
      alert(t('common_error', { err: String(err) }));
    } finally {
      setSaving(false);
    }
  };

  const equipmentOptions = [
    { id: 'stove', label: t('onboarding_eq_stove') },
    { id: 'oven', label: t('onboarding_eq_oven') },
    { id: 'microwave', label: t('onboarding_eq_microwave') },
    { id: 'blender', label: t('onboarding_eq_blender') },
    { id: 'multicooker', label: t('onboarding_eq_multicooker') },
    { id: 'airfryer', label: t('onboarding_eq_airfryer') },
    { id: 'wok', label: t('onboarding_eq_wok') },
  ];

  const allergyOptions = [
    { id: 'none', label: t('onboarding_alg_none') },
    { id: 'lactose', label: t('onboarding_alg_lactose') },
    { id: 'gluten', label: t('onboarding_alg_gluten') },
    { id: 'nuts', label: t('onboarding_alg_nuts') },
    { id: 'seafood', label: t('onboarding_alg_seafood') },
    { id: 'eggs', label: t('onboarding_alg_eggs') },
    { id: 'soy', label: t('onboarding_alg_soy') },
  ];

  const cuisineOptions = [
    { id: 'italian', label: t('onboarding_cui_italian'), short: 'Итальянская и средиземноморская' },
    { id: 'asian', label: t('onboarding_cui_asian'), short: 'Азиатская' },
    { id: 'homestyle', label: t('onboarding_cui_homestyle'), short: 'Домашняя классика' },
    { id: 'mexican', label: t('onboarding_cui_mexican'), short: 'Мексиканская / Текс-Мекс' },
    { id: 'caucasian', label: t('onboarding_cui_caucasian'), short: 'Грузинская и кавказская' },
    { id: 'american', label: t('onboarding_cui_american'), short: 'Американская / Стритфуд' },
    { id: 'fitness', label: t('onboarding_cui_fitness'), short: 'Фитнес-меню / ПП' },
  ];

  const suggestedDisliked = [
    'кинза',
    'оливки',
    'вареный лук',
    'печенка',
    'сельдерей',
    'брокколи',
    'грибы',
    'майонез',
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header with Progress Bar */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 pb-5 relative">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 font-black text-sm">
                FC
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight">
                  {t('onboarding_title')}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {currentStep === 1 && t('onboarding_block1_name')}
                  {currentStep === 2 && t('onboarding_block2_name')}
                  {currentStep === 3 && t('onboarding_block3_name')}
                  {currentStep === 4 && t('onboarding_block4_name')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSkipConfirm(true)}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl hover:bg-slate-800 transition font-semibold"
            >
              {t('onboarding_btn_skip')}
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex items-center">
            <div
              className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
            <span>
              {t('onboarding_step_indicator', { step: currentStep, total: totalSteps })}
            </span>
            <span>{Math.round((currentStep / totalSteps) * 100)}%</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: SKILLS, TIME, SERVINGS, EQUIPMENT */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Q1: Culinary Skills */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <ChefHat className="w-4 h-4 text-orange-600" />
                  <span>{t('onboarding_q1_title')}</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    { id: 'beginner', label: t('onboarding_q1_opt1'), icon: '🍳' },
                    { id: 'home_cook', label: t('onboarding_q1_opt2'), icon: '🍲' },
                    { id: 'advanced', label: t('onboarding_q1_opt3'), icon: '👨‍🍳' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSkillLevel(opt.id as any)}
                      className={`text-left p-3.5 rounded-2xl border transition flex items-start gap-3 ${
                        skillLevel === opt.id
                          ? 'border-orange-500 bg-orange-50/50 text-slate-900 ring-2 ring-orange-500/20'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <span className="text-xl shrink-0 mt-0.5">{opt.icon}</span>
                      <span className="text-xs sm:text-sm font-medium leading-snug">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q2: Cooking Time on Weekdays */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Clock className="w-4 h-4 text-orange-600" />
                  <span>{t('onboarding_q2_title')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'under_20', label: t('onboarding_q2_opt1'), badge: '⚡ 15-20 мин' },
                    { id: '30_45', label: t('onboarding_q2_opt2'), badge: '⏳ 30-45 мин' },
                    { id: 'over_60', label: t('onboarding_q2_opt3'), badge: '🧘 > 1 часа' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCookingTime(opt.id)}
                      className={`text-left p-3.5 rounded-2xl border transition flex flex-col justify-between gap-2 ${
                        cookingTime === opt.id
                          ? 'border-orange-500 bg-orange-50/50 text-slate-900 ring-2 ring-orange-500/20'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <span className="text-xs font-black text-orange-600 bg-orange-100/60 px-2 py-0.5 rounded-md w-fit">
                        {opt.badge}
                      </span>
                      <span className="text-xs font-medium leading-tight">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q Servings: Household context */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Users className="w-4 h-4 text-orange-600" />
                  <span>{t('onboarding_q_servings_title')}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { num: 1, label: t('onboarding_q_servings_opt1'), icon: '👤' },
                    { num: 2, label: t('onboarding_q_servings_opt2'), icon: '👫' },
                    { num: 4, label: t('onboarding_q_servings_opt3'), icon: '👨‍👩‍👧‍👦' },
                    { num: 3, label: t('onboarding_q_servings_opt4'), icon: '👶' },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setServings(item.num)}
                      className={`p-3 rounded-2xl border transition text-center flex flex-col items-center gap-1 ${
                        servings === item.num
                          ? 'border-orange-500 bg-orange-50 text-orange-950 font-bold ring-2 ring-orange-500/20'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span className="text-xs leading-tight">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q3: Kitchen Equipment & Cookware */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <Utensils className="w-4 h-4 text-orange-600" />
                    <span>{t('onboarding_q3_title')}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {t('onboarding_q3_hint')}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {equipmentOptions.map((eq) => {
                    const isSelected = equipment.includes(eq.label);
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => toggleEquipment(eq.label)}
                        className={`text-left p-3 rounded-xl border transition flex items-center justify-between gap-2 text-xs font-semibold ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50/70 text-orange-950'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                        }`}
                      >
                        <span>{eq.label}</span>
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center border shrink-0 ${
                            isSelected
                              ? 'bg-orange-600 border-orange-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: DIET, ALLERGIES & STOP-LIST */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Q4: Diet Type */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Flame className="w-4 h-4 text-emerald-600" />
                  <span>{t('onboarding_q4_title')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'omnivore', label: t('onboarding_q4_opt_omnivore'), icon: '🥩' },
                    { id: 'vegetarian', label: t('onboarding_q4_opt_vegetarian'), icon: '🥗' },
                    { id: 'vegan', label: t('onboarding_q4_opt_vegan'), icon: '🌱' },
                    { id: 'pescatarian', label: t('onboarding_q4_opt_pescatarian'), icon: '🐟' },
                    { id: 'keto', label: t('onboarding_q4_opt_keto'), icon: '🥑' },
                    { id: 'halal_kosher', label: t('onboarding_q4_opt_halal_kosher'), icon: '✨' },
                  ].map((diet) => (
                    <button
                      key={diet.id}
                      type="button"
                      onClick={() => setDietType(diet.id)}
                      className={`text-left p-3 rounded-2xl border transition flex items-start gap-2.5 ${
                        dietType === diet.id
                          ? 'border-emerald-500 bg-emerald-50/50 text-slate-900 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <span className="text-lg shrink-0">{diet.icon}</span>
                      <span className="text-xs font-semibold leading-tight mt-0.5">{diet.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q5: Allergies & Intolerances */}
              <div className="space-y-2 bg-rose-50/50 p-4 rounded-2xl border border-rose-200/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>{t('onboarding_q5_title')}</span>
                  </div>
                  <span className="text-[10px] text-rose-700 font-semibold bg-rose-100 px-2 py-0.5 rounded-full">
                    Фильтр безопасности
                  </span>
                </div>
                <p className="text-[11px] text-rose-700">{t('onboarding_q5_hint')}</p>

                <div className="flex flex-wrap gap-2 pt-2">
                  {allergyOptions.map((alg) => {
                    const isSelected =
                      alg.id === 'none'
                        ? allergies.length === 0
                        : allergies.includes(alg.label);
                    return (
                      <button
                        key={alg.id}
                        type="button"
                        onClick={() => toggleAllergy(alg.id === 'none' ? 'none' : alg.label)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                          isSelected
                            ? alg.id === 'none'
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{alg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q6: Stop-list Disliked Ingredients */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Ban className="w-4 h-4 text-rose-500" />
                  <span>{t('onboarding_q6_title')}</span>
                </div>
                <p className="text-xs text-slate-500">{t('onboarding_q6_hint')}</p>

                {/* Input with Add button */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dislikedInput}
                    onChange={(e) => setDislikedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddDisliked();
                      }
                    }}
                    placeholder={t('onboarding_q6_placeholder')}
                    className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddDisliked()}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
                  >
                    Добавить
                  </button>
                </div>

                {/* Active Disliked Tags */}
                {dislikedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {dislikedTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200"
                      >
                        🚫 {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveDisliked(tag)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Quick Suggestion Pills */}
                <div className="pt-2">
                  <span className="block text-[10px] text-slate-400 font-bold uppercase mb-1.5">
                    Часто добавляют в стоп-лист:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedDisliked.map((sug) => {
                      const alreadyAdded = dislikedTags.includes(sug);
                      return (
                        <button
                          key={sug}
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() => handleAddDisliked(sug)}
                          className={`px-2 py-0.5 rounded-md text-[11px] transition ${
                            alreadyAdded
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed line-through'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          + {sug}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CUISINES & SPICE */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Q7: Favorite Cuisines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>{t('onboarding_q7_title')}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {t('onboarding_q7_hint')} ({cuisines.length}/4)
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {cuisineOptions.map((cui) => {
                    const isSelected = cuisines.includes(cui.short);
                    return (
                      <button
                        key={cui.id}
                        type="button"
                        onClick={() => toggleCuisine(cui.short)}
                        className={`text-left p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/60 text-slate-900 ring-2 ring-amber-500/20'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-semibold">{cui.label}</span>
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center border shrink-0 ${
                            isSelected
                              ? 'bg-amber-500 border-amber-500 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Q8: Spice Tolerance */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Flame className="w-4 h-4 text-orange-600" />
                  <span>{t('onboarding_q8_title')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'none', label: t('onboarding_q8_opt1'), icon: '🌱', badge: 'Без остроты' },
                    { id: 'mild', label: t('onboarding_q8_opt2'), icon: '🧄', badge: 'Легкая пикантность' },
                    { id: 'hot', label: t('onboarding_q8_opt3'), icon: '🌶️', badge: 'Поострее' },
                  ].map((sp) => (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setSpiceTolerance(sp.id)}
                      className={`text-left p-3.5 rounded-2xl border transition flex flex-col justify-between gap-2 ${
                        spiceTolerance === sp.id
                          ? 'border-orange-500 bg-orange-50/60 text-slate-900 ring-2 ring-orange-500/20'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{sp.icon}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-800">
                          {sp.badge}
                        </span>
                      </div>
                      <span className="text-xs font-medium leading-tight">{sp.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: ACTIVITY & NUTRITION GOAL */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* Q9: Physical Activity */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <span>{t('onboarding_q9_title')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'sedentary', label: t('onboarding_q9_opt1'), icon: '💻' },
                    { id: 'moderate', label: t('onboarding_q9_opt2'), icon: '🚶' },
                    { id: 'active', label: t('onboarding_q9_opt3'), icon: '🏃' },
                    { id: 'very_active', label: t('onboarding_q9_opt4'), icon: '🏋️' },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setActivityLevel(act.id as any)}
                      className={`text-left p-3.5 rounded-2xl border transition flex items-start gap-2.5 ${
                        activityLevel === act.id
                          ? 'border-blue-500 bg-blue-50/50 text-slate-900 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <span className="text-xl shrink-0 mt-0.5">{act.icon}</span>
                      <span className="text-xs font-semibold leading-tight">{act.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Q10: Primary Nutrition Goal */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Target className="w-4 h-4 text-emerald-600" />
                  <span>{t('onboarding_q10_title')}</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    { id: 'tasty_balanced', label: t('onboarding_q10_opt1'), icon: '🍲' },
                    { id: 'high_protein', label: t('onboarding_q10_opt2'), icon: '🥩' },
                    { id: 'weight_loss', label: t('onboarding_q10_opt3'), icon: '⚖️' },
                    { id: 'energy_balance', label: t('onboarding_q10_opt4'), icon: '⚡' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setNutritionalGoal(g.id)}
                      className={`text-left p-3.5 rounded-2xl border transition flex items-center gap-3 ${
                        nutritionalGoal === g.id
                          ? 'border-emerald-500 bg-emerald-50/60 text-slate-900 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <span className="text-2xl shrink-0">{g.icon}</span>
                      <span className="text-xs sm:text-sm font-semibold leading-snug">{g.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('onboarding_btn_back')}</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold transition flex items-center gap-1.5 shadow-md shadow-orange-500/20 ml-auto"
            >
              <span>{t('onboarding_btn_next')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSavePreferences(false)}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition flex items-center gap-2 shadow-md shadow-emerald-600/20 ml-auto"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Сохранение...' : t('onboarding_btn_finish')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Skip Confirmation Modal */}
      {showSkipConfirm && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">{t('onboarding_skip_title')}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {t('onboarding_skip_desc')}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setShowSkipConfirm(false);
                  handleSavePreferences(true);
                }}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition shadow-sm"
              >
                {t('onboarding_skip_confirm_btn')}
              </button>
              <button
                type="button"
                onClick={() => setShowSkipConfirm(false)}
                className="w-full py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition"
              >
                {t('onboarding_skip_cancel_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
