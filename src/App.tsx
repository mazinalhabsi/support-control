import { useEffect, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useProgress } from './store/progress';
import { Dashboard } from './pages/Dashboard';
import { Onboarding } from './pages/Onboarding';
import { Placement } from './pages/Placement';
import { Course } from './pages/Course';
import { LessonPage } from './pages/Lesson';
import { Review } from './pages/Review';
import { Practice } from './pages/Practice';
import { PronunciationList, PronunciationTopicPage } from './pages/Pronunciation';
import { LibraryList, ReadingPage } from './pages/Library';
import { GrammarReference } from './pages/Grammar';
import { Vocabulary } from './pages/Vocabulary';
import { Profile } from './pages/Profile';

// A host (e.g. an embedding viewer) may already set data-theme; "system" restores it.
const hostTheme = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;

/** Keep <html lang/dir> and the colour theme in sync with settings. */
function useDocumentSettings() {
  const uiLang = useProgress((s) => s.settings.uiLang);
  const theme = useProgress((s) => s.settings.theme);
  useEffect(() => {
    const html = document.documentElement;
    html.lang = uiLang;
    html.dir = uiLang === 'ar' ? 'rtl' : 'ltr';
    if (theme !== 'system') html.setAttribute('data-theme', theme);
    else if (hostTheme) html.setAttribute('data-theme', hostTheme);
    else html.removeAttribute('data-theme');
  }, [uiLang, theme]);
}

function RequireProfile({ children }: { children: ReactNode }) {
  const onboarded = useProgress((s) => s.profile?.onboarded);
  return onboarded ? <>{children}</> : <Navigate to="/welcome" replace />;
}

export default function App() {
  useDocumentSettings();
  return (
    <HashRouter>
      <Routes>
        <Route path="/welcome" element={<Onboarding />} />
        <Route
          element={
            <RequireProfile>
              <Layout />
            </RequireProfile>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="placement" element={<Placement />} />
          <Route path="learn" element={<Course />} />
          <Route path="lesson/:id" element={<LessonPage />} />
          <Route path="review" element={<Review />} />
          <Route path="practice" element={<Practice />} />
          <Route path="pronunciation" element={<PronunciationList />} />
          <Route path="pronunciation/:id" element={<PronunciationTopicPage />} />
          <Route path="library" element={<LibraryList />} />
          <Route path="library/:id" element={<ReadingPage />} />
          <Route path="grammar" element={<GrammarReference />} />
          <Route path="vocabulary" element={<Vocabulary />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
