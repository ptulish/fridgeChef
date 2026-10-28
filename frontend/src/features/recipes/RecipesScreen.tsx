import React, { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { MEAT_KEYWORDS } from '../../shared/constants';
import { RecipeMatch, Recipe, RecipeVersion } from '../../types';
import { useI18n } from '../../app/I18nContext';
import {
  Clock,
  ChefHat,
  ShoppingCart,
  AlertTriangle,
  Check,
  Layers,
  ChevronRight,
  X,
  Sparkles,
  RefreshCw,
  Flame,
  Target,
  ShoppingBag,
} from 'lucide-react';

interface RecipesScreenProps {
  onStartCooking: (recipeId: string, versionId: string, servings: number) => void;
  onNavigateToShopping: () => void;
}

export const RecipesScreen: React.FC<RecipesScreenProps> = ({ onStartCooking, onNavigateToShopping }) => {
  const { t } = useI18n();
  const [matchedRecipes, setMatchedRecipes] = useState<RecipeMatch[]>([]);
  const [ribbons, setRibbons] = useState<Array<{ id: string; title_key: string; type: string; recipes: RecipeMatch[] }>>([]);
  const [activeRibbonId, setActiveRibbonId] = useState<string>('cook_now');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'ready' | 'missing_few'>('all');

  // Detailed Modal
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [servings, setServings] = useState<number>(1);
  const [meatQty, setMeatQty] = useState<number>(200);
  const [addingToCart, setAddingToCart] = useState(false);

  // Substitution state in recipe modal
  const [subModalIngredient, setSubModalIngredient] = useState<string | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subOptions, setSubOptions] = useState<Array<{ name: string; notes: string; in_pantry: boolean; pantry_item_id?: string | null }>>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [matches, recRibbons] = await Promise.all([
        api.getMatchedRecipes(),
        api.getRecommendations().catch(() => ({ ribbons: [] })),
      ]);
      setMatchedRecipes(matches);
      if (recRibbons && recRibbons.ribbons) {
        setRibbons(recRibbons.ribbons);
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

  const openRecipeDetails = async (recipeId: string, versionId: string) => {
    try {
      const fullRecipe = await api.getRecipe(recipeId);
      setSelectedRecipe(fullRecipe);
      const vId = versionId || fullRecipe.versions[fullRecipe.versions.length - 1].id;
      setSelectedVersionId(vId);

      const v = fullRecipe.versions.find((ver) => ver.id === vId) || fullRecipe.versions[0];
      const baseMeat = findMeatIngredient(v);
      const baseM = baseMeat?.quantity ? Number(baseMeat.quantity) : 200;
      setMeatQty(baseM);
      setServings(fullRecipe.base_servings || 1);
    } catch (err) {
      alert(t('recipes_error_load', { err: String(err) }));
    }
  };

  const handleOpenSubstitutions = async (ingName: string) => {
    setSubModalIngredient(ingName);
    setSubLoading(true);
    setSubOptions([]);
    try {
      const resp = await api.substituteIngredient({
        ingredient_name: ingName,
        recipe_name: selectedRecipe?.title,
      });
      setSubOptions(resp.substitutions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSubLoading(false);
    }
  };

  const currentVersion: RecipeVersion | undefined = selectedRecipe?.versions.find(
    (v) => v.id === selectedVersionId
  );

  const findMeatIngredient = (version?: RecipeVersion) => {
    if (!version) return null;
    return version.ingredients.find(
      (i) =>
        i.role === 'required' &&
        MEAT_KEYWORDS.some((kw) => i.ingredient_name_snapshot.toLowerCase().includes(kw))
    );
  };

  const meatIng = findMeatIngredient(currentVersion);
  const baseMeatQty = meatIng?.quantity ? Number(meatIng.quantity) : 200;

  const handleMeatChange = (newMeatAmt: number) => {
    const validAmt = Math.max(10, newMeatAmt);
    setMeatQty(validAmt);
    const newServings = Number((validAmt / baseMeatQty).toFixed(2));
    setServings(newServings);
  };

  const handleServingsChange = (newServings: number) => {
    const validServ = Math.max(0.5, newServings);
    setServings(validServ);
    setMeatQty(Math.round(validServ * baseMeatQty));
  };

  const handleAddToCart = async () => {
    if (!selectedRecipe || !selectedVersionId) return;
    try {
      setAddingToCart(true);
      await api.addRecipeToShopping({
        recipe_id: selectedRecipe.id,
        recipe_version_id: selectedVersionId,
        servings: Math.max(1, Math.round(servings)),
      });
      alert(t('recipes_cart_added_alert'));
      onNavigateToShopping();
    } catch (err) {
      alert(t('common_error', { err: String(err) }));
    } finally {
      setAddingToCart(false);
    }
  };

  const handleQuickAddRecipeToCart = async (recipeId: string, versionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.addRecipeToShopping({
        recipe_id: recipeId,
        recipe_version_id: versionId,
        servings: 1,
      });
      alert(t('recipes_cart_added_alert'));
    } catch (err) {
      alert(t('common_error', { err: String(err) }));
    }
  };

  const filtered = matchedRecipes.filter((m) => {
    if (filter === 'ready') return m.can_cook_now;
    if (filter === 'missing_few') return m.missing_required_count <= 2 && !m.can_cook_now;
    return true;
  });

  const activeRibbon = ribbons.find((r) => r.id === activeRibbonId) || ribbons[0];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{t('recipes_title')}</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">{t('recipes_desc')}</p>
        </div>
      </div>

      {/* PHASE 4: 3 AI RECOMMENDATION RIBBONS */}
      {ribbons.length > 0 && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-5 sm:p-6 rounded-3xl text-white shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-base sm:text-lg text-slate-100">
                  {t('recipes_recommendations_title')}
                </h2>
                <span className="text-[11px] text-slate-400">
                  {t('recipes_recommendations_desc')}
                </span>
              </div>
            </div>

            {/* Ribbon Segmented Switcher */}
            <div className="flex gap-1.5 p-1 bg-slate-800/80 rounded-2xl border border-slate-700/60 overflow-x-auto max-w-full">
              {ribbons.map((rib) => {
                const isActive = rib.id === activeRibbonId;
                const icon =
                  rib.id === 'cook_now' ? (
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                  ) : rib.id === 'finish_low' ? (
                    <Target className="w-3.5 h-3.5 text-orange-400" />
                  ) : (
                    <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
                  );

                return (
                  <button
                    key={rib.id}
                    onClick={() => setActiveRibbonId(rib.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      isActive
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                    }`}
                  >
                    {icon}
                    <span>{t(rib.title_key as any)}</span>
                    <span className="text-[10px] opacity-75">({rib.recipes.length})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ribbon Items Carousel / Horizontal Grid */}
          {activeRibbon && activeRibbon.recipes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
              {activeRibbon.recipes.slice(0, 3).map((recipe) => {
                const missing = recipe.ingredients
                  .filter((i) => i.match_status === 'missing_required' || i.match_status === 'insufficient')
                  .map((i) => i.ingredient_name);

                return (
                  <div
                    key={recipe.recipe_id}
                    onClick={() => openRecipeDetails(recipe.recipe_id, recipe.recipe_version_id)}
                    className="p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition flex flex-col justify-between cursor-pointer group shadow-sm hover:border-orange-500/50"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-semibold text-orange-400 bg-orange-950/60 px-2.5 py-0.5 rounded-md border border-orange-800/60">
                          {recipe.cuisine || t('recipes_default_cuisine')}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            recipe.can_cook_now
                              ? 'bg-emerald-900/80 text-emerald-300'
                              : 'bg-amber-900/80 text-amber-300'
                          }`}
                        >
                          {recipe.can_cook_now ? '100% ' + t('status_in_stock') : `${recipe.match_percentage}%`}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-slate-100 group-hover:text-orange-400 transition line-clamp-1">
                        {recipe.recipe_title}
                      </h4>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                        {recipe.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {t('common_minutes', { count: recipe.duration_minutes })}
                          </span>
                        )}
                        <span className="capitalize">{recipe.difficulty}</span>
                      </div>

                      {missing.length > 0 && (
                        <div className="mt-2.5 text-[11px] text-amber-300 bg-amber-950/40 p-2 rounded-xl border border-amber-900/60">
                          <span className="font-bold block text-amber-200">
                            Не хватает ({missing.length}):
                          </span>
                          <span className="line-clamp-1">{missing.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-700/60 flex items-center justify-between gap-2">
                      {missing.length > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => handleQuickAddRecipeToCart(recipe.recipe_id, recipe.recipe_version_id, e)}
                          className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>В покупки</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-bold">✓ Всё есть дома</span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartCooking(recipe.recipe_id, recipe.recipe_version_id, 1);
                        }}
                        className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
                      >
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>{t('recipes_cook_btn')}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">
              Нет рецептов в данной подборке под текущий набор продуктов.
            </p>
          )}
        </div>
      )}

      {/* Main Tab Filters (All, Ready, Missing Few) */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            filter === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('recipes_filter_all')} ({matchedRecipes.length})
        </button>
        <button
          onClick={() => setFilter('ready')}
          className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            filter === 'ready' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          {t('recipes_filter_ready')} ({matchedRecipes.filter((m) => m.can_cook_now).length})
        </button>
        <button
          onClick={() => setFilter('missing_few')}
          className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
            filter === 'missing_few' ? 'bg-orange-600 text-white shadow-sm' : 'text-orange-700 hover:bg-orange-50'
          }`}
        >
          {t('recipes_filter_missing_few')}
        </button>
      </div>

      {/* Full Recipe Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
          <span>{t('recipes_matching')}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filtered.map((recipe) => {
            const missingItems = recipe.ingredients
              .filter((i) => i.match_status === 'missing_required' || i.match_status === 'insufficient')
              .map((i) => i.ingredient_name);

            const checkItems = recipe.ingredients
              .filter((i) => i.match_status === 'needs_confirmation')
              .map((i) => i.ingredient_name);

            return (
              <div
                key={recipe.recipe_id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {recipe.cuisine || t('recipes_default_cuisine')}
                    </span>
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        recipe.can_cook_now
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {recipe.can_cook_now ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          100% {t('recipes_match_ready')}
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          {recipe.match_percentage}%
                        </>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-snug hover:text-orange-600 transition">
                    {recipe.recipe_title}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-2.5">
                    {recipe.duration_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {t('common_minutes', { count: recipe.duration_minutes })}
                      </span>
                    )}
                    <span className="capitalize">{t('common_difficulty')}: {recipe.difficulty}</span>
                  </div>

                  {/* Missing Breakdown */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    {missingItems.length > 0 && (
                      <div className="text-xs text-rose-800 bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl">
                        <span className="font-bold block text-rose-900 mb-0.5">
                          {t('recipes_missing_items', { count: missingItems.length })}
                        </span>
                        <span>{missingItems.join(', ')}</span>
                      </div>
                    )}

                    {checkItems.length > 0 && (
                      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl">
                        <span className="font-bold block text-amber-900 mb-0.5">
                          {t('recipes_check_items', { count: checkItems.length })}
                        </span>
                        <span>{checkItems.join(', ')}</span>
                      </div>
                    )}

                    {recipe.can_cook_now && (
                      <div className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl font-medium border border-emerald-100">
                        {t('recipes_all_in_stock')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => openRecipeDetails(recipe.recipe_id, recipe.recipe_version_id)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    {t('recipes_view_recipe')}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onStartCooking(recipe.recipe_id, recipe.recipe_version_id, 1)}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <ChefHat className="w-3.5 h-3.5" />
                    {t('recipes_cook_btn')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Recipe Modal */}
      {selectedRecipe && currentVersion && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-800">
                    {selectedRecipe.cuisine || t('recipes_dish_fallback')}
                  </span>
                  <span className="text-xs text-slate-400">
                    {t('common_minutes', { count: selectedRecipe.duration_minutes })} • {selectedRecipe.difficulty}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800">{selectedRecipe.title}</h2>
                <p className="text-xs text-slate-500 mt-1">{selectedRecipe.description}</p>
              </div>
              <button
                onClick={() => setSelectedRecipe(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              {/* Version History Selector */}
              <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-700">{t('recipes_version_history')}:</span>
                </div>
                <select
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {selectedRecipe.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {t('cooking_version_label', { num: v.version_number })}{' '}
                      {v.is_base_version ? t('recipes_version_original') : `(${v.change_summary.slice(0, 30)}...)`}
                    </option>
                  ))}
                </select>
              </div>

              {/* MEAT SCALING CONTROL */}
              {meatIng && (
                <div className="p-4 bg-orange-50/70 border border-orange-200 rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">🥩</span>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          {t('recipes_meat_portion')} ({meatIng.ingredient_name_snapshot})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t('recipes_base_meat_note', { qty: baseMeatQty, unit: meatIng.unit })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleMeatChange(meatQty - 50)}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 shadow-sm"
                      >
                        -50
                      </button>
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1 shadow-sm">
                        <input
                          type="number"
                          step="10"
                          value={meatQty}
                          onChange={(e) => handleMeatChange(parseFloat(e.target.value) || baseMeatQty)}
                          className="w-16 font-bold text-orange-600 text-center text-sm focus:outline-none"
                        />
                        <span className="text-xs font-semibold text-slate-500 ml-1">{meatIng.unit}</span>
                      </div>
                      <button
                        onClick={() => handleMeatChange(meatQty + 50)}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 shadow-sm"
                      >
                        +50
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-orange-100 text-xs">
                    <span className="text-slate-600">
                      {t('recipes_servings_ratio', { ratio: servings.toFixed(2) })}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[150, 200, 250, 300, 400, 500].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => handleMeatChange(amt)}
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border transition ${
                            meatQty === amt
                              ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-orange-100/50'
                          }`}
                        >
                          {t('common_grams_abbr', { count: amt })}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Standard Servings Counter */}
              {!meatIng && (
                <div className="flex items-center justify-between bg-orange-50/40 border border-orange-100 p-3 rounded-xl">
                  <span className="text-sm font-semibold text-slate-800">{t('recipes_portions_label')}</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleServingsChange(servings - 1)}
                      className="w-8 h-8 bg-white rounded-lg border border-slate-200 font-bold text-slate-700 hover:bg-slate-100"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold text-orange-600 w-10 text-center">
                      {servings}
                    </span>
                    <button
                      onClick={() => handleServingsChange(servings + 1)}
                      className="w-8 h-8 bg-white rounded-lg border border-slate-200 font-bold text-slate-700 hover:bg-slate-100"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Ingredients List with Sub Block */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  {meatIng
                    ? t('recipes_ingredients_for_meat', { meatQty, servings: servings.toFixed(2) })
                    : t('recipes_ingredients_for_servings', { servings })}
                </h4>

                <div className="border border-slate-200 bg-white rounded-2xl p-4 divide-y divide-slate-100">
                  {currentVersion.ingredients.map((ing, idx) => {
                    const factor = servings / (selectedRecipe.base_servings || 1);
                    const scaledQty =
                      ing.quantity !== null && ing.scalable
                        ? (ing.quantity * factor).toFixed(1)
                        : ing.quantity;

                    return (
                      <div key={idx} className="py-2 flex items-center justify-between text-xs text-slate-700 gap-2">
                        <div>
                          <span className="font-medium text-slate-800">{ing.ingredient_name_snapshot}</span>
                          {ing.preparation_note && (
                            <span className="text-slate-400 italic ml-1">({ing.preparation_note})</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenSubstitutions(ing.ingredient_name_snapshot)}
                            className="ml-2 text-[10px] text-orange-600 font-semibold hover:underline"
                          >
                            🔄 {t('substitute_btn')}
                          </button>
                        </div>
                        <span className="font-bold text-slate-900 whitespace-nowrap">
                          {scaledQty !== null ? `${scaledQty} ${ing.unit}` : ing.unit}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  {t('recipes_instructions')}
                </h4>
                <div className="space-y-3">
                  {currentVersion.steps.map((s) => (
                    <div key={s.step_number} className="p-3 bg-slate-50 rounded-xl text-xs flex gap-3">
                      <span className="w-5 h-5 flex-shrink-0 rounded-full bg-orange-600 text-white font-bold flex items-center justify-center text-[10px]">
                        {s.step_number}
                      </span>
                      <div>
                        <p className="text-slate-700 leading-relaxed">{s.instruction}</p>
                        {s.duration_seconds && (
                          <span className="inline-block mt-1 text-[11px] text-slate-400 font-medium">
                            {t('recipes_step_duration', { min: Math.round(s.duration_seconds / 60) })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={handleAddToCart}
                disabled={addingToCart}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{addingToCart ? t('recipes_cart_adding') : t('recipes_add_to_cart')}</span>
              </button>

              <button
                onClick={() => {
                  const rId = selectedRecipe.id;
                  const vId = selectedVersionId;
                  const s = parseFloat(servings.toFixed(2));
                  setSelectedRecipe(null);
                  onStartCooking(rId, vId, s);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <ChefHat className="w-4 h-4" />
                <span>
                  {meatIng
                    ? t('recipes_start_cooking_meat', { meatQty })
                    : t('recipes_start_cooking_servings', { servings })}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Substitutions Sub-Modal */}
      {subModalIngredient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-orange-600" />
                  {t('substitute_title')}
                </h3>
                <span className="text-xs text-slate-500">
                  Для: <strong className="text-orange-600">{subModalIngredient}</strong>
                </span>
              </div>
              <button
                onClick={() => setSubModalIngredient(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {subLoading ? (
              <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-orange-600" />
                <span className="text-xs">{t('substitute_loading')}</span>
              </div>
            ) : subOptions.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                {t('substitute_empty')}
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                {subOptions.map((sub, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-2xl border flex flex-col justify-between gap-1.5 ${
                      sub.in_pantry
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">{sub.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          sub.in_pantry
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {sub.in_pantry ? '✓ ' + t('substitute_in_stock') : t('substitute_not_in_stock')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{sub.notes}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSubModalIngredient(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
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
