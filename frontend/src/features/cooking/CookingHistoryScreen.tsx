import React, { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import { CookingSession } from '../../types';
import { useI18n } from '../../app/I18nContext';
import { Calendar, Star, ChefHat, MessageSquare } from 'lucide-react';

export const CookingHistoryScreen: React.FC = () => {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<CookingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await api.getSessions();
        setSessions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-800">{t('cooking_title')}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t('cooking_history_desc')}
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">{t('cooking_loading_history')}</div>
      ) : sessions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <ChefHat className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">{t('cooking_history_empty')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg text-slate-800">
                    {sess.recipe?.title || t('recipes_title')}
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-600">
                    {t('cooking_version_label', { num: sess.recipe_version?.version_number || 1 })}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(sess.cooked_at).toLocaleDateString()}
                  </span>
                  <span>{t('common_servings_abbr', { count: sess.servings })}</span>
                  <span
                    className={`font-semibold capitalize ${
                      sess.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {sess.status === 'completed' ? t('cooking_status_completed') : sess.status}
                  </span>
                </div>

                {sess.notes && <p className="text-xs text-slate-600">{sess.notes}</p>}
              </div>

              {/* Review summary block */}
              {sess.review && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center min-w-[240px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">{t('cooking_taste_rating_label')}</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="text-sm font-bold text-slate-800">
                        {sess.review.taste_rating || 5}/5
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>{t('cooking_saltiness_label')}</span>
                      <span className="font-semibold">{sess.review.saltiness_rating}/5</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('cooking_sauce_label')}</span>
                      <span className="font-semibold">{sess.review.sauce_amount_rating}/5</span>
                    </div>
                  </div>

                  {sess.review.comment && (
                    <div className="mt-2 pt-2 border-t border-slate-200 flex items-start gap-1.5 text-xs text-slate-500 italic">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>«{sess.review.comment}»</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
