import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useProgress } from './store/progress';
import { MotionProvider } from './motion/MotionProvider';
import { SparkLayer } from './components/fx/Celebrate';
import { RouteLoading } from './components/ui';

// Route-level code splitting: each page downloads when first visited.
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Placement = lazy(() => import('./pages/Placement').then((m) => ({ default: m.Placement })));
const Course = lazy(() => import('./pages/Course').then((m) => ({ default: m.Course })));
const LessonPage = lazy(() => import('./pages/Lesson').then((m) => ({ default: m.LessonPage })));
const Review = lazy(() => import('./pages/Review').then((m) => ({ default: m.Review })));
const Practice = lazy(() => import('./pages/Practice').then((m) => ({ default: m.Practice })));
const PronunciationList = lazy(() => import('./pages/Pronunciation').then((m) => ({ default: m.PronunciationList })));
const PronunciationTopicPage = lazy(() => import('./pages/Pronunciation').then((m) => ({ default: m.PronunciationTopicPage })));
const LibraryList = lazy(() => import('./pages/Library').then((m) => ({ default: m.LibraryList })));
const ReadingPage = lazy(() => import('./pages/Library').then((m) => ({ default: m.ReadingPage })));
const GrammarReference = lazy(() => import('./pages/Grammar').then((m) => ({ default: m.GrammarReference })));
const Vocabulary = lazy(() => import('./pages/Vocabulary').then((m) => ({ default: m.Vocabulary })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const StudioHome = lazy(() => import('./pages/studio/StudioHome').then((m) => ({ default: m.StudioHome })));
const RolePlay = lazy(() => import('./pages/studio/RolePlay').then((m) => ({ default: m.RolePlay })));
const Shadowing = lazy(() => import('./pages/studio/Shadowing').then((m) => ({ default: m.Shadowing })));
const Listening = lazy(() => import('./pages/studio/Listening').then((m) => ({ default: m.Listening })));
const Sprint = lazy(() => import('./pages/studio/Sprint').then((m) => ({ default: m.Sprint })));
const Spelling = lazy(() => import('./pages/studio/Spelling').then((m) => ({ default: m.Spelling })));

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
  return onboarded ? <>{children}</> : <Navigate to="/start" replace />;
}

export default function App() {
  useDocumentSettings();
  return (
    <MotionProvider>
      <HashRouter>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/start" element={<Landing />} />
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
              <Route path="studio" element={<StudioHome />} />
              <Route path="studio/roleplay" element={<RolePlay />} />
              <Route path="studio/shadowing" element={<Shadowing />} />
              <Route path="studio/listening" element={<Listening />} />
              <Route path="studio/sprint" element={<Sprint />} />
              <Route path="studio/spelling" element={<Spelling />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
      <SparkLayer />
    </MotionProvider>
  );
}
