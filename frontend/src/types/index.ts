export interface Ingredient {
  id: string;
  canonical_name: string;
  category: string;
  default_unit: string;
  density_g_per_ml?: number | null;
}

export interface PantryItem {
  id: string;
  user_id: string;
  ingredient_id: string;
  quantity: number | null;
  unit: string;
  status: 'in_stock' | 'low' | 'out' | 'needs_confirmation';
  storage_zone?: 'fridge' | 'freezer' | 'pantry';
  is_staple?: boolean;
  fuzzy_level?: 'full' | 'half' | 'low' | 'almost_empty' | 'out' | null;
  package_size?: number | null;
  best_before?: string | null;
  last_confirmed_at?: string | null;
  source: string;
  notes?: string | null;
  ingredient?: Ingredient | null;
}

export interface RecipeIngredient {
  id?: string;
  ingredient_id?: string | null;
  ingredient_name_snapshot: string;
  quantity: number | null;
  unit: string;
  role: 'required' | 'optional' | 'garnish' | 'marinade' | 'main_sauce';
  preparation_note?: string | null;
  scalable: boolean;
  inventory_ref?: string | null;
  availability?: 'in_stock' | 'staple' | 'to_buy';
}

export interface RecipeStep {
  id?: string;
  step_number: number;
  instruction: string;
  duration_seconds?: number | null;
  temperature_c?: number | null;
  equipment?: string | null;
}

export interface RecipeMacros {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
}

export interface RecipeVersion {
  id: string;
  recipe_id: string;
  version_number: number;
  parent_version_id?: string | null;
  change_summary: string;
  is_base_version: boolean;
  created_at: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export interface RecipeSource {
  source_type: string;
  source_name: string;
  source_url?: string | null;
  attribution?: string | null;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  cuisine?: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  duration_minutes?: number | null;
  base_servings: number;
  visibility: string;
  source?: RecipeSource | null;
  versions: RecipeVersion[];
  macros_per_serving?: RecipeMacros | null;
  why_this_recipe?: string | null;
  equipment_used?: string[];
}

export interface MatchedIngredient {
  ingredient_id?: string | null;
  ingredient_name: string;
  role: string;
  required_quantity: number | null;
  required_unit: string;
  pantry_quantity: number | null;
  pantry_unit?: string | null;
  pantry_status?: string | null;
  match_status: 'sufficient' | 'insufficient' | 'needs_confirmation' | 'missing_required' | 'missing_optional';
  deficit_quantity?: number | null;
  notes?: string | null;
}

export interface RecipeMatch {
  recipe_id: string;
  recipe_version_id: string;
  recipe_title: string;
  cuisine?: string | null;
  difficulty: string;
  duration_minutes?: number | null;
  match_percentage: number;
  can_cook_now: boolean;
  needs_confirmation_count: number;
  missing_required_count: number;
  missing_optional_count: number;
  insufficient_count: number;
  ingredients: MatchedIngredient[];
}

export interface CookingSession {
  id: string;
  user_id: string;
  recipe_id: string;
  recipe_version_id: string;
  servings: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  notes?: string | null;
  actual_changes?: Record<string, any> | null;
  cooked_at: string;
  recipe?: Recipe | null;
  recipe_version?: RecipeVersion | null;
  review?: Review | null;
}

export interface Review {
  id: string;
  user_id: string;
  cooking_session_id: string;
  taste_rating?: number | null;
  saltiness_rating?: number | null;
  sauce_amount_rating?: number | null;
  sweetness_rating?: number | null;
  acidity_rating?: number | null;
  texture_rating?: number | null;
  comment?: string | null;
  created_at: string;
}

export interface UserTasteProfile {
  id: string;
  user_id: string;
  meat_preferences: Record<string, any>;
  favorite_cuisines: string[];
  sauce_preference: Record<string, any>;
  salt_sensitivity: string;
  disliked_ingredients: string[];
  equipment: string[];
  habits: Record<string, any>;

  // Culinary DNA & Body Stats
  skill_level?: 'beginner' | 'home_cook' | 'advanced' | 'chef';
  diet_modes?: string[];
  active_mode?: string;
  weight_kg?: number | null;
  height_cm?: number | null;
  activity_level?: string;
  meals_per_day?: number;
  computed_daily_kcal?: number | null;
  target_meal_kcal?: number | null;
  allergies?: string[];
  ingredient_affinity?: Record<string, number>;
  cuisine_affinity?: Record<string, number>;
  flavor_params?: Record<string, any>;

  ai_profile_summary: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  user_id: string;
  inventory_item_id?: string | null;
  cooking_session_id?: string | null;
  delta_quantity?: number | null;
  unit?: string | null;
  fuzzy_before?: string | null;
  fuzzy_after?: string | null;
  reason: 'cooked' | 'manual' | 'undo';
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  shopping_list_id: string;
  ingredient_id?: string | null;
  item_name: string;
  quantity?: number | null;
  unit: string;
  is_bought: boolean;
  recipe_id?: string | null;
}

export interface ShoppingList {
  id: string;
  user_id: string;
  title: string;
  status: string;
  created_at: string;
  items: ShoppingListItem[];
}
