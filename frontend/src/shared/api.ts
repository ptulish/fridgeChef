import {
  PantryItem,
  Ingredient,
  Recipe,
  RecipeMatch,
  RecipeVersion,
  CookingSession,
  Review,
  UserTasteProfile,
  ShoppingList,
  ShoppingListItem,
  InventoryTransaction,
} from '../types';
const API_BASE = import.meta.env.VITE_API_URL
  ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, '')}/api/v1`
  : '/api/v1';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errorDetail = 'API request failed';
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(errorDetail);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const api = {
  // Auth
  getMe: () => request<{ id: string; name: string; email: string }>('/auth/me'),

  // Pantry
  getPantry: () => request<PantryItem[]>('/pantry'),
  upsertPantryItem: (data: {
    ingredient_id?: string;
    custom_ingredient_name?: string;
    category?: string;
    quantity: number | null;
    unit: string;
    status: string;
    storage_zone?: string;
    is_staple?: boolean;
    fuzzy_level?: string | null;
    package_size?: number | null;
    best_before?: string | null;
    notes?: string | null;
  }) =>
    request<PantryItem>('/pantry', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  bulkConfirmPantry: (items: Array<{ id: string; quantity?: number | null; unit?: string; status?: string }>) =>
    request<PantryItem[]>('/pantry/confirm-bulk', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  deletePantryItem: (id: string) =>
    request<void>(`/pantry/${id}`, {
      method: 'DELETE',
    }),
  getCanonicalIngredients: () => request<Ingredient[]>('/pantry/catalog/ingredients'),

  // Recipes
  getRecipes: () => request<Recipe[]>('/recipes'),
  getMatchedRecipes: () => request<RecipeMatch[]>('/recipes/matched'),
  getRecommendations: () => request<{ ribbons: Array<{ id: string; title_key: string; type: string; recipes: RecipeMatch[] }> }>('/recipes/recommendations'),
  getRecipe: (id: string) => request<Recipe>(`/recipes/${id}`),
  adaptRecipe: (
    id: string,
    data: {
      parent_version_id: string;
      change_summary: string;
      ingredients: any[];
      steps: any[];
    }
  ) =>
    request<RecipeVersion>(`/recipes/${id}/adapt`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Cooking
  getSessions: () => request<CookingSession[]>('/cooking/sessions'),
  startSession: (data: { recipe_id: string; recipe_version_id: string; servings: number }) =>
    request<CookingSession>('/cooking/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSession: (id: string) => request<CookingSession>(`/cooking/sessions/${id}`),
  getDepletionPreview: (sessionId: string) =>
    request<{ session_id: string; deductions: Array<{ ingredient_name: string; pantry_item_id: string | null; amount_needed: number; unit: string; current_qty: number | null; new_qty: number | null; current_fuzzy: string | null; new_fuzzy: string | null; will_deplete: boolean; is_staple?: boolean }> }>(
      `/cooking/sessions/${sessionId}/depletion-preview`,
      { method: 'POST' }
    ),
  completeSession: (id: string, data: { notes?: string; actual_changes?: any; deductions?: any[] }) =>
    request<CookingSession>(`/cooking/sessions/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  submitReview: (
    sessionId: string,
    review: {
      taste_rating?: number;
      saltiness_rating?: number;
      sauce_amount_rating?: number;
      sweetness_rating?: number;
      acidity_rating?: number;
      texture_rating?: number;
      comment?: string;
      quick_notes?: string[];
    }
  ) =>
    request<Review>(`/cooking/sessions/${sessionId}/review`, {
      method: 'POST',
      body: JSON.stringify(review),
    }),

  // Taste Profile Card
  getTasteProfile: () => request<UserTasteProfile>('/profile'),
  updateTasteProfile: (data: Partial<UserTasteProfile>) =>
    request<UserTasteProfile>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Shopping List
  getShoppingList: () => request<ShoppingList>('/shopping'),
  addShoppingItem: (data: {
    item_name: string;
    quantity?: number | null;
    unit?: string;
    ingredient_id?: string | null;
    recipe_id?: string | null;
  }) =>
    request<ShoppingListItem>('/shopping/items', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  addRecipeToShopping: (data: { recipe_id: string; recipe_version_id: string; servings: number }) =>
    request<ShoppingList>('/shopping/add-recipe', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  toggleShoppingItem: (id: string) =>
    request<ShoppingListItem>(`/shopping/items/${id}/toggle`, {
      method: 'PATCH',
    }),
  deleteShoppingItem: (id: string) =>
    request<void>(`/shopping/items/${id}`, {
      method: 'DELETE',
    }),
  clearBoughtItems: () =>
    request<ShoppingList>('/shopping/clear-bought', {
      method: 'DELETE',
    }),

  // AI Chef
  getAIStatus: () =>
    request<{ has_gemini_key: boolean; model: string; provider: string }>('/ai/status'),
  configureGeminiKey: (apiKey: string) =>
    request<{ status: string; has_gemini_key: boolean; model: string; message: string }>('/ai/configure-key', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey }),
    }),
  generateAIRecipe: (
    params?:
      | string
      | {
          prompt?: string;
          mode?: string;
          satiety_level?: 'light' | 'standard' | 'hearty';
          marinate_meat?: boolean;
          marinate_duration_minutes?: number | null;
          must_use_ingredients?: string[];
        }
  ) => {
    const body = typeof params === 'string' ? { prompt: params } : (params || {});
    return request<any>('/ai/generate-recipe', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  refineAIRecipe: (currentRecipe: any, refinementPrompt: string) =>
    request<any>('/ai/refine-recipe', {
      method: 'POST',
      body: JSON.stringify({
        current_recipe: currentRecipe,
        refinement_prompt: refinementPrompt,
      }),
    }),

  saveGeneratedRecipe: (recipeData: any) =>
    request<Recipe>('/ai/save-generated-recipe', {
      method: 'POST',
      body: JSON.stringify(recipeData),
    }),
  suggestAdaptation: (data: { recipe_id: string; recipe_version_id: string; cooking_session_id: string }) =>
    request<any>('/ai/suggest-adaptation', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  // Inventory Transactions Ledger
  getInventoryTransactions: () => request<InventoryTransaction[]>('/inventory/transactions'),
  undoTransaction: (id: string) =>
    request<{ status: string; restored_item: PantryItem }>(`/inventory/transactions/${id}/undo`, {
      method: 'POST',
    }),

  // Substitutions
  substituteIngredient: (data: { ingredient_name: string; recipe_name?: string }) =>
    request<{ substitutions: Array<{ name: string; notes: string; in_pantry: boolean; pantry_item_id?: string | null }> }>('/ai/substitute', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
