import React, { useState } from 'react';
import { useI18n } from './I18nContext';
import { PantryScreen } from '../features/pantry/PantryScreen';
import { RecipesScreen } from '../features/recipes/RecipesScreen';
import { CookingHistoryScreen } from '../features/cooking/CookingHistoryScreen';
import { TasteProfileScreen } from '../features/profile/TasteProfileScreen';
import { ShoppingListScreen } from '../features/shopping/ShoppingListScreen';
import { AIChefScreen } from '../features/ai-chef/AIChefScreen';
import { CookingModal } from '../features/cooking/CookingModal';
import {
  Refrigerator,
  BookOpen,
  History,
  UserCheck,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';

export const App: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  const [activeTab, setActiveTab] = useState<'pantry' | 'recipes' | 'cooking' | 'profile' | 'shopping' | 'ai'>('recipes');

  // Active cooking session
  const [cookingSession, setCookingSession] = useState<{
    recipeId: string;
    versionId: string;
    servings: number;
  } | null>(null);

  const navItems = [
    { id: 'recipes', label: t('nav_recipes'), icon: BookOpen },
    { id: 'pantry', label: t('nav_pantry'), icon: Refrigerator },
    { id: 'cooking', label: t('nav_cooking'), icon: History },
    { id: 'profile', label: t('nav_profile'), icon: UserCheck },
    { id: 'shopping', label: t('nav_shopping'), icon: ShoppingCart },
    { id: 'ai', label: t('nav_ai'), icon: Sparkles, highlight: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div
              onClick={() => setActiveTab('recipes')}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <span className="font-black text-lg text-slate-800 tracking-tight">FridgeChef</span>
                <span className="hidden md:inline-block ml-2 text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                  Smart Studio
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                      isActive
                        ? item.highlight
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm'
                          : 'bg-slate-900 text-white shadow-sm'
                        : item.highlight
                        ? 'text-orange-600 hover:bg-orange-50'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Right Controls: Language Switcher */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  onClick={() => setLanguage('ru')}
                  className={`px-2 py-1 rounded-lg transition ${
                    language === 'ru' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  RU
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-1 rounded-lg transition ${
                    language === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Screen Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-28 md:pb-8">
        {activeTab === 'recipes' && (
          <RecipesScreen
            onStartCooking={(rId, vId, s) =>
              setCookingSession({ recipeId: rId, versionId: vId, servings: s })
            }
            onNavigateToShopping={() => setActiveTab('shopping')}
          />
        )}
        {activeTab === 'pantry' && <PantryScreen />}
        {activeTab === 'cooking' && <CookingHistoryScreen />}
        {activeTab === 'profile' && <TasteProfileScreen />}
        {activeTab === 'shopping' && <ShoppingListScreen />}
        {activeTab === 'ai' && (
          <AIChefScreen onRecipeSaved={() => setActiveTab('recipes')} />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Thumb Friendly) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition ${
                isActive
                  ? item.highlight
                    ? 'text-orange-600 font-extrabold'
                    : 'text-slate-900 font-extrabold'
                  : item.highlight
                  ? 'text-orange-500/80 font-medium'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition ${
                  isActive
                    ? item.highlight
                      ? 'bg-orange-50 text-orange-600'
                      : 'bg-slate-100 text-slate-900'
                    : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${item.highlight && !isActive ? 'text-orange-500' : ''}`} />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[56px] text-center leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Active Cooking Mode Modal */}
      {cookingSession && (
        <CookingModal
          recipeId={cookingSession.recipeId}
          versionId={cookingSession.versionId}
          servings={cookingSession.servings}
          onClose={() => setCookingSession(null)}
          onFinished={() => {
            setCookingSession(null);
            setActiveTab('cooking');
          }}
        />
      )}
    </div>
  );
};
