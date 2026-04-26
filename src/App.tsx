import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { ProgressBar } from './components/ProgressBar';
import { IntroScreen } from './components/Intro/IntroScreen';
import { GroupStage } from './components/Groups/GroupStage';
import { ThirdPlaceSelector } from './components/ThirdPlace/ThirdPlaceSelector';
import { BracketView } from './components/Bracket/BracketView';
import { SaveStatus } from './components/SaveStatus';
import './App.css';

function AppContent() {
  const { state, goToStep } = useApp();

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
    <div className="app">
      <Header />
      {state.step !== 'intro' && (
        <ProgressBar
          currentStep={state.step}
          furthestStep={state.furthestStep}
          onStepClick={goToStep}
        />
      )}
      <main className="app-main">
        {renderStep()}
      </main>
      <SaveStatus />
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
