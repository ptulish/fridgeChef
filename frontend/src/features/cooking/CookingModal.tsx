import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import { Recipe, RecipeVersion, CookingSession } from '../../types';
import { useI18n } from '../../app/I18nContext';
import {
  Clock,
  Play,
  Pause,
  RotateCcw,
  Check,
  Star,
  X,
  Sparkles,
  ChefHat,
  ArrowRight,
  ShoppingCart,
  RefreshCw,
  AlertCircle,
  PackageCheck,
} from 'lucide-react';

interface CookingModalProps {
  recipeId: string;
  versionId: string;
  servings: number;
  onClose: () => void;
  onFinished: () => void;
}

interface DepletionItemState {
  ingredient_name: string;
  pantry_item_id: string | null;
  amount_needed: number;
  unit: string;
  current_qty: number | null;
  new_qty: number | null;
  current_fuzzy: string | null;
  new_fuzzy: string | null;
  will_deplete: boolean;
  is_staple: boolean;
  custom_deduct: number;
  custom_fuzzy: string;
  custom_out: boolean;
}

export const CookingModal: React.FC<CookingModalProps> = ({
  recipeId,
  versionId,
  servings,
  onClose,
  onFinished,
}) => {
  const { t } = useI18n();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [version, setVersion] = useState<RecipeVersion | null>(null);
  const [session, setSession] = useState<CookingSession | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<{ [step: number]: boolean }>({});
  const [activeTabMobile, setActiveTabMobile] = useState<'step' | 'ingredients' | 'all_steps'>('step');
  const [leftTab, setLeftTab] = useState<'steps' | 'ingredients'>('steps');

  // Countdown timer state
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);

  // Depletion review mode
  const [showDepletion, setShowDepletion] = useState<boolean>(false);
  const [loadingDepletion, setLoadingDepletion] = useState<boolean>(false);
  const [depletionItems, setDepletionItems] = useState<DepletionItemState[]>([]);
  const [addedToCart, setAddedToCart] = useState<boolean>(false);
  const [completingSession, setCompletingSession] = useState<boolean>(false);

  // Substitution modal
  const [substitutingIngName, setSubstitutingIngName] = useState<string | null>(null);
  const [loadingSubs, setLoadingSubs] = useState<boolean>(false);
  const [substitutions, setSubstitutions] = useState<Array<{ name: string; notes: string; in_pantry: boolean; pantry_item_id?: string | null }>>([]);
  const [appliedSubstitutions, setAppliedSubstitutions] = useState<{ [original: string]: string }>({});

  // Review mode
  const [showReview, setShowReview] = useState(false);
  const [tasteRating, setTasteRating] = useState<number>(4);
  const [saltinessRating, setSaltinessRating] = useState<number>(3);
  const [sauceAmountRating, setSauceAmountRating] = useState<number>(3);
  const [sweetnessRating, setSweetnessRating] = useState<number>(3);
  const [acidityRating, setAcidityRating] = useState<number>(3);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [selectedQuickNotes, setSelectedQuickNotes] = useState<string[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Adaptation preview
  const [showAdaptationPrompt, setShowAdaptationPrompt] = useState(false);
  const [adapting, setAdapting] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const [rec, sess] = await Promise.all([
          api.getRecipe(recipeId),
          api.startSession({ recipe_id: recipeId, recipe_version_id: versionId, servings }),
        ]);
        setRecipe(rec);
        const v = rec.versions.find((v) => v.id === versionId) || rec.versions[0];
        setVersion(v);
        setSession(sess);

        if (v && v.steps.length > 0 && v.steps[0].duration_seconds) {
          setTimerSeconds(v.steps[0].duration_seconds);
        }
      } catch (err) {
        alert(t('cooking_error_start', { err: String(err) }));
        onClose();
      }
    };
    init();
  }, [recipeId, versionId, servings]);

  // Timer tick
  useEffect(() => {
    let interval: any = null;
    if (timerActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && timerActive) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timerSeconds]);

  const selectStep = (idx: number) => {
    setCurrentStepIdx(idx);
    setTimerActive(false);
    if (version && version.steps[idx] && version.steps[idx].duration_seconds) {
      setTimerSeconds(version.steps[idx].duration_seconds || 0);
    } else {
      setTimerSeconds(0);
    }
    setActiveTabMobile('step');
  };

  const formatTimer = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Start Depletion Flow
  const handleInitiateFinishCooking = async () => {
    if (!session) return;
    try {
      setLoadingDepletion(true);
      const preview = await api.getDepletionPreview(session.id);
      const items: DepletionItemState[] = (preview.deductions || []).map((d) => ({
        ingredient_name: d.ingredient_name,
        pantry_item_id: d.pantry_item_id,
        amount_needed: d.amount_needed,
        unit: d.unit,
        current_qty: d.current_qty,
        new_qty: d.new_qty,
        current_fuzzy: d.current_fuzzy,
        new_fuzzy: d.new_fuzzy,
        will_deplete: d.will_deplete,
        is_staple: d.is_staple || false,
        custom_deduct: d.amount_needed,
        custom_fuzzy: d.new_fuzzy || 'low',
        custom_out: d.will_deplete,
      }));
      setDepletionItems(items);
      setShowDepletion(true);
    } catch (err) {
      console.error(err);
      setShowReview(true);
    } finally {
      setLoadingDepletion(false);
    }
  };

  // Confirm Depletion and Save to Ledger
  const handleConfirmDepletion = async () => {
    if (!session) return;
    try {
      setCompletingSession(true);
      const deductionsPayload = depletionItems
        .filter((d) => d.pantry_item_id)
        .map((d) => ({
          pantry_item_id: d.pantry_item_id,
          ingredient_name: d.ingredient_name,
          deduct_qty: d.custom_deduct,
          unit: d.unit,
          new_fuzzy: d.custom_out ? 'out' : d.custom_fuzzy,
          set_out: d.custom_out,
        }));

      await api.completeSession(session.id, {
        notes: t('cooking_cooked_servings', { servings }),
        actual_changes: appliedSubstitutions,
        deductions: deductionsPayload,
      });

      setShowDepletion(false);
      setShowReview(true);
    } catch (err) {
      alert(t('cooking_error_finish', { err: String(err) }));
    } finally {
      setCompletingSession(false);
    }
  };

  // Skip Depletion
  const handleSkipDepletion = async () => {
    if (!session) return;
    try {
      setCompletingSession(true);
      await api.completeSession(session.id, {
        notes: t('cooking_cooked_servings', { servings }),
        actual_changes: appliedSubstitutions,
      });
      setShowDepletion(false);
      setShowReview(true);
    } catch (err) {
      alert(t('cooking_error_finish', { err: String(err) }));
    } finally {
      setCompletingSession(false);
    }
  };

  // Add depleted items to shopping cart
  const handleAddDepletedToCart = async () => {
    const depleted = depletionItems.filter((d) => d.will_deplete || d.custom_out);
    if (depleted.length === 0) return;
    try {
      for (const item of depleted) {
        await api.addShoppingItem({
          item_name: item.ingredient_name,
          quantity: item.amount_needed,
          unit: item.unit,
        });
      }
      setAddedToCart(true);
      alert(t('depletion_add_shopping_btn') + ': ' + t('recipes_cart_added_alert'));
    } catch (err) {
      alert(t('common_error', { err: String(err) }));
    }
  };

  // Substitutions handler
  const handleOpenSubstitute = async (ingName: string) => {
    setSubstitutingIngName(ingName);
    setLoadingSubs(true);
    setSubstitutions([]);
    try {
      const resp = await api.substituteIngredient({
        ingredient_name: ingName,
        recipe_name: recipe?.title,
      });
      setSubstitutions(resp.substitutions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleApplySubstitute = (orig: string, subName: string) => {
    setAppliedSubstitutions({ ...appliedSubstitutions, [orig]: subName });
    setSubstitutingIngName(null);
  };

  const toggleQuickNote = (noteKey: string) => {
    if (selectedQuickNotes.includes(noteKey)) {
      setSelectedQuickNotes(selectedQuickNotes.filter((k) => k !== noteKey));
    } else {
      setSelectedQuickNotes([...selectedQuickNotes, noteKey]);
    }
  };

  const handleSaveReview = async () => {
    if (!session) return;
    try {
      setSubmittingReview(true);
      await api.submitReview(session.id, {
        taste_rating: tasteRating,
        saltiness_rating: saltinessRating,
        sauce_amount_rating: sauceAmountRating,
        sweetness_rating: sweetnessRating,
        acidity_rating: acidityRating,
        comment: reviewComment,
        quick_notes: selectedQuickNotes,
      });

      if (saltinessRating >= 4 || sauceAmountRating <= 2 || selectedQuickNotes.includes('too_salty') || selectedQuickNotes.includes('more_sauce')) {
        setShowAdaptationPrompt(true);
      } else {
        alert(t('cooking_review_saved_alert'));
        onFinished();
      }
    } catch (err) {
      alert(t('cooking_error_review', { err: String(err) }));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleGenerateAdaptation = async () => {
    if (!recipe || !version || !session) return;
    try {
      setAdapting(true);
      const adaptation = await api.suggestAdaptation({
        recipe_id: recipe.id,
        recipe_version_id: version.id,
        cooking_session_id: session.id,
      });

      await api.adaptRecipe(recipe.id, {
        parent_version_id: version.id,
        change_summary: adaptation.reason || t('recipes_adapted_version'),
        ingredients: adaptation.modified_ingredients || version.ingredients,
        steps: adaptation.modified_steps || version.steps,
      });

      alert(t('cooking_adapted_success_alert', { version: recipe.versions.length + 1 }));
      onFinished();
    } catch (err) {
      alert(t('cooking_error_adapt', { err: String(err) }));
    } finally {
      setAdapting(false);
    }
  };

  if (!recipe || !version) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 text-white">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
          <span>{t('cooking_launching_kitchen')}</span>
        </div>
      </div>
    );
  }

  const currentStep = version.steps[currentStepIdx] || version.steps[0];
  const depletedCount = depletionItems.filter((d) => d.will_deplete || d.custom_out).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-3 sm:p-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-orange-500/20">
            <ChefHat className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="truncate">
            <h2 className="font-bold text-sm sm:text-lg text-slate-100 truncate">{recipe.title}</h2>
            <span className="text-[11px] text-slate-400">
              {t('cooking_version_label', { num: version.version_number })} • {servings} {t('recipes_servings')}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          aria-label={t('common_cancel')}
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Main Kitchen View */}
      {!showDepletion && !showReview ? (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* Mobile Tab Switcher */}
          <div className="lg:hidden flex bg-slate-900 border-b border-slate-800 p-1 text-xs font-bold">
            <button
              onClick={() => setActiveTabMobile('step')}
              className={`flex-1 py-2 text-center rounded-lg transition ${
                activeTabMobile === 'step' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400'
              }`}
            >
              {t('cooking_step', { step: currentStepIdx + 1, total: version.steps.length })}
            </button>
            <button
              onClick={() => setActiveTabMobile('ingredients')}
              className={`flex-1 py-2 text-center rounded-lg transition ${
                activeTabMobile === 'ingredients' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400'
              }`}
            >
              {t('cooking_tab_ingredients')} ({version.ingredients.length})
            </button>
            <button
              onClick={() => setActiveTabMobile('all_steps')}
              className={`flex-1 py-2 text-center rounded-lg transition ${
                activeTabMobile === 'all_steps' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400'
              }`}
            >
              {t('cooking_tab_steps', { count: version.steps.length })}
            </button>
          </div>

          {/* Left Panel: Steps & Scaled Ingredients (Desktop always, Mobile via tabs) */}
          <div
            className={`w-full lg:w-84 bg-slate-900 border-r border-slate-800 p-4 overflow-y-auto space-y-3 ${
              activeTabMobile === 'step' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* Desktop Switcher */}
            <div className="hidden lg:grid grid-cols-2 p-1 bg-slate-800 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setLeftTab('steps')}
                className={`py-1.5 rounded-lg transition ${
                  leftTab === 'steps' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('cooking_tab_steps', { count: version.steps.length })}
              </button>
              <button
                type="button"
                onClick={() => setLeftTab('ingredients')}
                className={`py-1.5 rounded-lg transition ${
                  leftTab === 'ingredients' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('cooking_tab_ingredients')}
              </button>
            </div>

            {/* List Content */}
            {(leftTab === 'steps' || activeTabMobile === 'all_steps') && (
              <div className="space-y-2">
                {version.steps.map((s, idx) => (
                  <button
                    key={s.step_number}
                    onClick={() => selectStep(idx)}
                    className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition ${
                      currentStepIdx === idx
                        ? 'bg-orange-600 text-white font-bold shadow-md'
                        : completedSteps[s.step_number]
                        ? 'bg-slate-800/60 text-slate-400 line-through'
                        : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        completedSteps[s.step_number]
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {completedSteps[s.step_number] ? <Check className="w-3.5 h-3.5" /> : s.step_number}
                    </span>
                    <span className="text-xs line-clamp-2">{s.instruction}</span>
                  </button>
                ))}
              </div>
            )}

            {(leftTab === 'ingredients' || activeTabMobile === 'ingredients') && (
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider block">
                  {t('cooking_recalculated_for', { servings })}
                </span>
                <div className="space-y-2">
                  {version.ingredients.map((ing) => {
                    const factor = servings / (recipe.base_servings || 1);
                    const qty =
                      ing.quantity !== null && ing.quantity !== undefined
                        ? ing.scalable
                          ? Math.round(ing.quantity * factor * 100) / 100
                          : ing.quantity
                        : null;
                    const subName = appliedSubstitutions[ing.ingredient_name_snapshot];

                    return (
                      <div
                        key={ing.id}
                        className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-medium text-slate-200">
                              {subName ? (
                                <span>
                                  <span className="line-through text-slate-500 mr-1.5">{ing.ingredient_name_snapshot}</span>
                                  <span className="text-orange-400 font-bold">✨ {subName}</span>
                                </span>
                              ) : (
                                ing.ingredient_name_snapshot
                              )}
                            </div>
                            {ing.preparation_note && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {ing.preparation_note}
                              </div>
                            )}
                          </div>
                          {qty !== null && (
                            <span className="text-xs font-bold text-orange-400 whitespace-nowrap bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-700 shrink-0">
                              {qty} {ing.unit}
                            </span>
                          )}
                        </div>

                        {/* Substitution Button */}
                        <div className="flex justify-end pt-1 border-t border-slate-700/40">
                          <button
                            type="button"
                            onClick={() => handleOpenSubstitute(ing.ingredient_name_snapshot)}
                            className="text-[11px] font-medium text-slate-400 hover:text-orange-400 flex items-center gap-1 transition"
                          >
                            <RefreshCw className="w-3 h-3" />
                            {subName ? t('substitute_use_btn') : t('substitute_btn')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Main Panel: Step Instruction & Big Timer */}
          <div
            className={`flex-1 flex flex-col justify-between p-4 sm:p-8 lg:p-12 overflow-y-auto ${
              activeTabMobile !== 'step' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="max-w-3xl mx-auto w-full space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between text-slate-400 text-xs sm:text-sm font-semibold">
                <span>
                  {t('cooking_step', { step: currentStepIdx + 1, total: version.steps.length })}
                </span>
                {currentStep.duration_seconds && (
                  <span className="flex items-center gap-1.5 text-orange-400 font-bold">
                    <Clock className="w-4 h-4" />
                    {t('cooking_recommended_time', { min: Math.round(currentStep.duration_seconds / 60) })}
                  </span>
                )}
              </div>

              {/* Big Readable Step Card */}
              <div className="p-6 sm:p-10 bg-slate-900/90 rounded-3xl border border-slate-800 shadow-xl">
                <p className="text-lg sm:text-2xl lg:text-3xl font-medium leading-relaxed text-slate-100">
                  {currentStep.instruction}
                </p>
              </div>

              {/* Countdown Timer Widget */}
              {currentStep.duration_seconds && (
                <div className="bg-slate-900/80 border border-slate-800 p-4 sm:p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="text-4xl sm:text-5xl font-mono font-bold text-orange-500 tracking-wider">
                      {formatTimer(timerSeconds)}
                    </div>
                    {timerSeconds === 0 && (
                      <span className="text-xs sm:text-sm font-bold text-emerald-400 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-800 animate-pulse">
                        {t('cooking_time_up')}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setTimerActive(!timerActive)}
                      className="flex-1 sm:flex-initial px-5 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition"
                    >
                      {timerActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      {timerActive ? t('cooking_timer_pause') : t('cooking_timer_start')}
                    </button>
                    <button
                      onClick={() => {
                        setTimerActive(false);
                        setTimerSeconds(currentStep.duration_seconds || 0);
                      }}
                      className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                      title={t('cooking_timer_reset')}
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="max-w-3xl mx-auto w-full pt-6 sm:pt-8 flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setCompletedSteps({
                    ...completedSteps,
                    [currentStep.step_number]: !completedSteps[currentStep.step_number],
                  });
                }}
                className={`px-4 sm:px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
                  completedSteps[currentStep.step_number]
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                }`}
              >
                <Check className="w-4 h-4" />
                {t('cooking_done_step')}
              </button>

              <div className="flex gap-2 sm:gap-3">
                {currentStepIdx < version.steps.length - 1 ? (
                  <button
                    onClick={() => selectStep(currentStepIdx + 1)}
                    className="px-5 sm:px-7 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shadow-lg"
                  >
                    <span>{t('cooking_next_step')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleInitiateFinishCooking}
                    disabled={loadingDepletion}
                    className="px-5 sm:px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition shadow-xl flex items-center gap-2"
                  >
                    {loadingDepletion ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <PackageCheck className="w-4 h-4" />
                    )}
                    <span>{t('cooking_finish')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : showDepletion ? (
        /* STEP 1: Depletion Review Modal */
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl max-w-2xl w-full space-y-6 shadow-2xl">
            <div className="text-center space-y-1">
              <h3 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center justify-center gap-2">
                <PackageCheck className="w-6 h-6 text-orange-500" />
                {t('depletion_modal_title')}
              </h3>
              <p className="text-xs text-slate-400">
                {t('depletion_modal_desc')}
              </p>
            </div>

            {/* List of deductions */}
            <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
              {depletionItems.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    item.custom_out
                      ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                      : 'bg-slate-800/60 border-slate-700 text-slate-200'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">{item.ingredient_name}</span>
                      {item.is_staple && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-900 text-purple-200 font-semibold">
                          🧂 {t('staple_badge')}
                        </span>
                      )}
                      {item.custom_out && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-900 text-rose-200 font-bold uppercase">
                          {t('fuzzy_out')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span>{t('cooking_step', { step: 1, total: 1 }).replace('Шаг 1 из 1', 'Списание')}: {item.amount_needed} {item.unit}</span>
                      {item.current_qty !== null && (
                        <span>
                          (Остаток: {item.current_qty} {item.unit} → <strong className="text-white">{item.custom_out ? 0 : Math.max(0, Math.round((item.current_qty - item.custom_deduct) * 100) / 100)} {item.unit}</strong>)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Deduction Controls */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...depletionItems];
                        updated[idx].custom_out = !updated[idx].custom_out;
                        setDepletionItems(updated);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                        item.custom_out
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                      }`}
                    >
                      {item.custom_out ? '✓ ' + t('fuzzy_out') : t('staple_mark_out')}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Prompt to add depleted items to shopping cart */}
            {depletedCount > 0 && (
              <div className="p-3.5 rounded-2xl bg-orange-950/50 border border-orange-800/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-orange-200">
                  <AlertCircle className="w-5 h-5 text-orange-400 shrink-0" />
                  <span>{t('depletion_add_shopping_prompt')} ({depletedCount})</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddDepletedToCart}
                  disabled={addedToCart}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                    addedToCart
                      ? 'bg-emerald-700 text-white cursor-default'
                      : 'bg-orange-600 hover:bg-orange-700 text-white shadow-sm'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {addedToCart ? '✓ Добавлено' : t('depletion_add_shopping_btn')}
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleSkipDepletion}
                disabled={completingSession}
                className="w-full sm:w-1/3 py-3 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition text-center"
              >
                {t('depletion_skip_btn')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDepletion}
                disabled={completingSession}
                className="w-full sm:w-2/3 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition shadow-lg flex items-center justify-center gap-2"
              >
                {completingSession ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{t('depletion_confirm_btn')}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: Review Screen Mode with Taste Evolution & Quick Chips */
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl max-w-xl w-full space-y-6 shadow-2xl">
            <h3 className="text-xl sm:text-2xl font-bold text-orange-400 text-center">
              {t('review_modal_title')}
            </h3>
            <p className="text-xs text-slate-400 text-center">
              {t('cooking_review_prompt')}
            </p>

            {/* Overall Taste Stars */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2 text-center">
                {t('review_taste_rating')} (1-5)
              </label>
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setTasteRating(star)}
                    className="p-1 transition transform hover:scale-110"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= tasteRating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Feedback Chips */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                {t('feedback_quick_title')}
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'too_salty', label: t('feedback_chip_too_salty') },
                  { key: 'more_sauce', label: t('feedback_chip_more_sauce') },
                  { key: 'too_spicy', label: t('feedback_chip_too_spicy') },
                  { key: 'will_repeat', label: t('feedback_chip_will_repeat') },
                ].map((chip) => {
                  const isSelected = selectedQuickNotes.includes(chip.key);
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => toggleQuickNote(chip.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                        isSelected
                          ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                      }`}
                    >
                      {isSelected ? '✓ ' : '+ '}
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Saltiness Slider */}
            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-300 uppercase">
                  {t('review_salt_rating')}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    saltinessRating === 5
                      ? 'bg-rose-900 text-rose-300'
                      : saltinessRating === 3
                      ? 'bg-emerald-900 text-emerald-300'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {saltinessRating === 1
                    ? t('review_salt_1')
                    : saltinessRating === 3
                    ? t('review_salt_3')
                    : saltinessRating === 5
                    ? t('review_salt_5')
                    : `${saltinessRating}/5`}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={saltinessRating}
                onChange={(e) => setSaltinessRating(parseInt(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                <span>1 ({t('review_salt_1')})</span>
                <span>3 ({t('review_salt_3')})</span>
                <span>5 ({t('review_salt_5')})</span>
              </div>
            </div>

            {/* Sauce Amount Slider */}
            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-300 uppercase">
                  {t('review_sauce_rating')}
                </span>
                <span className="text-xs font-bold text-orange-400">
                  {sauceAmountRating === 1
                    ? t('review_sauce_1')
                    : sauceAmountRating === 3
                    ? t('review_sauce_3')
                    : t('review_sauce_5')}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={sauceAmountRating}
                onChange={(e) => setSauceAmountRating(parseInt(e.target.value))}
                className="w-full accent-orange-500"
              />
            </div>

            {/* Sweetness Slider */}
            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-300 uppercase">
                  {t('review_sweetness') || 'Сладость'}
                </span>
                <span className="text-xs font-bold text-orange-400">
                  {sweetnessRating}/5
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={sweetnessRating}
                onChange={(e) => setSweetnessRating(parseInt(e.target.value))}
                className="w-full accent-orange-500"
              />
            </div>

            {/* Acidity Slider */}
            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-800">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-300 uppercase">
                  {t('review_acidity') || 'Кислотность'}
                </span>
                <span className="text-xs font-bold text-orange-400">
                  {acidityRating}/5
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={acidityRating}
                onChange={(e) => setAcidityRating(parseInt(e.target.value))}
                className="w-full accent-orange-500"
              />
            </div>

            {/* Comment */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                {t('review_comment')}
              </label>
              <textarea
                rows={2}
                placeholder={t('cooking_review_placeholder')}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleSaveReview}
                disabled={submittingReview}
                className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm transition shadow-lg"
              >
                {submittingReview ? t('common_saving') : t('review_save_btn')}
              </button>

              {showAdaptationPrompt && (
                <div className="p-4 bg-amber-950/60 border border-amber-800 rounded-2xl space-y-3">
                  <p className="text-xs text-amber-200">
                    {t('cooking_adapt_prompt', { version: recipe.versions.length + 1 })}
                  </p>
                  <button
                    onClick={handleGenerateAdaptation}
                    disabled={adapting}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    {adapting ? t('cooking_adapting') : t('review_adapt_btn', { next: recipe.versions.length + 1 })}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* In-Pantry Substitution Drawer / Modal */}
      {substitutingIngName && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-orange-500" />
                  {t('substitute_title')}
                </h3>
                <span className="text-xs text-slate-400">
                  Для ингредиента: <strong className="text-orange-400">{substitutingIngName}</strong>
                </span>
              </div>
              <button
                onClick={() => setSubstitutingIngName(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingSubs ? (
              <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
                <span className="text-xs">{t('substitute_loading')}</span>
              </div>
            ) : substitutions.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                {t('substitute_empty')}
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                {substitutions.map((sub, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl border flex flex-col justify-between gap-2 ${
                      sub.in_pantry
                        ? 'bg-emerald-950/30 border-emerald-800 text-emerald-100'
                        : 'bg-slate-800/40 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-white">{sub.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                            sub.in_pantry
                              ? 'bg-emerald-900 text-emerald-200'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {sub.in_pantry ? '✓ ' + t('substitute_in_stock') : t('substitute_not_in_stock')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{sub.notes}</p>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleApplySubstitute(substitutingIngName, sub.name)}
                        className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        {t('substitute_use_btn')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSubstitutingIngName(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
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
