import React, { useState } from 'react';
import { useAuth } from '../../app/AuthContext';
import { useI18n } from '../../app/I18nContext';
import { UtensilsCrossed, Lock, Mail, User as UserIcon, ArrowRight, Sparkles, ChefHat, AlertCircle } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, register, demoLogin } = useAuth();
  const { t, language, setLanguage } = useI18n();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim() || !password) {
          throw new Error(t('auth_fill_all_fields'));
        }
        await login(email.trim(), password);
      } else {
        if (!name.trim() || !email.trim() || !password) {
          throw new Error(t('auth_fill_all_fields'));
        }
        if (password.length < 4) {
          throw new Error(t('auth_password_too_short'));
        }
        await register(name.trim(), email.trim(), password);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setLoading(true);
    try {
      await demoLogin();
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Language Switcher in Top Right */}
      <div className="absolute top-6 right-6 flex items-center bg-slate-800/80 backdrop-blur-md p-1 rounded-xl border border-slate-700/60 text-xs font-bold text-white z-10">
        <button
          onClick={() => setLanguage('ru')}
          className={`px-2.5 py-1 rounded-lg transition ${
            language === 'ru' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          RU
        </button>
        <button
          onClick={() => setLanguage('en')}
          className={`px-2.5 py-1 rounded-lg transition ${
            language === 'en' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          EN
        </button>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative z-10">
        {/* Header Banner */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-8 text-white text-center relative">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-4 shadow-inner">
            <UtensilsCrossed className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center justify-center gap-2">
            FridgeChef
            <span className="text-xs font-bold uppercase tracking-widest bg-white/25 px-2 py-0.5 rounded-full">
              Studio
            </span>
          </h1>
          <p className="text-orange-100 text-xs mt-2 font-medium max-w-xs mx-auto">
            {t('auth_subtitle')}
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 p-1.5 m-6 mb-4 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t('auth_tab_login')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t('auth_tab_register')}
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t('auth_label_name')}
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth_placeholder_name')}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('auth_label_email')}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chef@example.com"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('auth_label_password')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white rounded-xl text-sm font-bold shadow-md shadow-orange-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>{mode === 'login' ? t('auth_btn_login') : t('auth_btn_register')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Quick Demo Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider text-slate-400 font-bold">
              <span className="bg-white px-3">{t('auth_or')}</span>
            </div>
          </div>

          {/* Demo Login Button */}
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
          >
            <ChefHat className="w-4 h-4 text-orange-600" />
            <span>{t('auth_btn_demo')}</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          </button>
        </form>
      </div>
    </div>
  );
};
