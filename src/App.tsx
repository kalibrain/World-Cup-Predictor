import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { ProgressBar } from './components/ProgressBar';
import { IntroScreen } from './components/Intro/IntroScreen';
import { GroupStage } from './components/Groups/GroupStage';
import { ThirdPlaceSelector } from './components/ThirdPlace/ThirdPlaceSelector';
import { BracketView } from './components/Bracket/BracketView';
import { SharePanel } from './components/Share/SharePanel';
import './App.css';

function AppContent() {
  const { state, isViewOnly, goToStep } = useApp();

  const renderStep = () => {
    if (isViewOnly) {
      // View-only: show bracket if they have picks, otherwise share
      if (state.step === 'bracket' || state.step === 'groups' || state.step === 'third-place') {
        return <BracketView />;
      }
      return <SharePanel />;
    }

    switch (state.step) {
      case 'intro':
        return <IntroScreen />;
      case 'groups':
        return <GroupStage />;
      case 'third-place':
        return <ThirdPlaceSelector />;
      case 'bracket':
        return <BracketView />;
      case 'share':
        return <SharePanel />;
      default:
        return <IntroScreen />;
    }
  };

  return (
    <div className="app">
      <Header />
      {state.step !== 'intro' && (
        <ProgressBar
          currentStep={isViewOnly ? 'share' : state.step}
          furthestStep={isViewOnly ? 'share' : state.furthestStep}
          onStepClick={isViewOnly ? undefined : goToStep}
        />
      )}
      <main className="app-main">
        {renderStep()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
