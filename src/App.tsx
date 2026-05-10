import { useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Header } from './components/Header';
import { ProgressBar } from './components/ProgressBar';
import { IntroScreen } from './components/Intro/IntroScreen';
import { GroupStage } from './components/Groups/GroupStage';
import { ThirdPlaceSelector } from './components/ThirdPlace/ThirdPlaceSelector';
import { BracketView } from './components/Bracket/BracketView';
import { SaveStatus } from './components/SaveStatus';
import { AdminShell } from './components/Admin/AdminShell';
import { RequireAdmin } from './components/Admin/RequireAdmin';
import { LeaderboardPage } from './components/Leaderboard/LeaderboardPage';
import { FAQPage } from './components/FAQPage';
import { PrivacyPolicyPage, TermsOfServicePage } from './components/LegalPage';
import './App.css';

function PredictorShell() {
  const { state, goToStep } = useApp();

  useLayoutEffect(() => {
    if (state.step === 'intro') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [state.step]);

  const renderStep = () => {
    switch (state.step) {
      case 'intro':
        return <IntroScreen />;
      case 'groups':
        return <GroupStage />;
      case 'third-place':
        return <ThirdPlaceSelector />;
      case 'bracket':
        return <BracketView />;
      default:
        return <IntroScreen />;
    }
  };

  return (
    <>
      {state.step !== 'intro' && (
        <ProgressBar
          currentStep={state.step}
          furthestStep={state.furthestStep}
          onStepClick={goToStep}
        />
      )}
      <main className="app-main">{renderStep()}</main>
    </>
  );
}

function Shell() {
  return (
    <div className="app">
      <Header />
      <Routes>
        <Route
          path="/admin/*"
          element={
            <RequireAdmin>
              <AdminShell />
            </RequireAdmin>
          }
        />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/*" element={<PredictorShell />} />
      </Routes>
      <SaveStatus />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AppProvider>
            <Shell />
          </AppProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
