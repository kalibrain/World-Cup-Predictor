import { Link } from 'react-router-dom';

const contactEmail = 'mail@kalibrain.com';

export function PrivacyPolicyPage() {
  return (
    <main className="app-main">
      <div className="faq-page">
        <header className="faq-header">
          <div>
            <div className="leaderboard-eyebrow">My Bracket Picks</div>
            <h1 className="faq-title">Privacy Policy</h1>
            <p className="faq-intro">Effective date: May 6, 2026</p>
          </div>
          <Link to="/" className="btn btn-outline btn-sm faq-back">
            Back Home
          </Link>
        </header>

        <section className="faq-section legal-section">
          <h2 className="faq-section-title">Overview</h2>
          <p className="faq-copy">
            My Bracket Picks helps users create and manage World Cup bracket predictions. This
            policy explains what information we collect, how we use it, and how to contact us.
          </p>
        </section>

        <section className="faq-section legal-section">
          <h2 className="faq-section-title">Information We Collect</h2>
          <p className="faq-copy">
            When you sign in with Google, we receive basic account information such as your name,
            email address, profile image, and Google account identifier through Supabase Auth. We
            also store the bracket names, tournament memberships, prediction selections, tie-breaker
            picks, save status, and related tournament participation data you create in the app.
          </p>
          <p className="faq-copy">
            We may receive basic technical information needed to operate the site, such as browser,
            device, and request information handled by GitHub Pages, Supabase, and Google.
          </p>
        </section>

        <section className="faq-section legal-section">
          <h2 className="faq-section-title">How We Use Information</h2>
          <p className="faq-copy">
            We use your information to sign you in, save and restore your predictions, manage access
            to public and private tournaments, show leaderboards where available, prevent abuse, and
            operate and improve the app.
          </p>
        </section>

        <section className="faq-section legal-section">
          <h2 className="faq-section-title">Sharing</h2>
          <p className="faq-copy">
            We do not sell personal information. We share information only with service providers
            needed to run the app, including Supabase for authentication and database services,
            Google for sign-in, and GitHub Pages for hosting. Tournament administrators may see
            participant and bracket information needed to manage their tournaments.
          </p>
        </section>

        <section className="faq-section legal-section">
          <h2 className="faq-section-title">Data Retention And Choices</h2>
          <p className="faq-copy">
            We keep account and prediction data while it is needed to provide the app, maintain
            tournament records, and support leaderboard features. To request deletion of your account
            data or bracket information, contact us at{' '}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </section>

        <section className="faq-section legal-section">
          <h2 className="faq-section-title">Contact</h2>
          <p className="faq-copy">
            Questions about this policy can be sent to{' '}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </section>
      </div>
    </main>
  );
}

export function TermsOfServicePage() {
  return (
    <main className="app-main">
      <div className="faq-page">
        <header className="faq-header">
          <div>
            <div className="leaderboard-eyebrow">My Bracket Picks</div>
            <h1 className="faq-title">Terms Of Service</h1>
            <p className="faq-intro">Effective date: May 6, 2026</p>
          </div>
          <Link to="/" className="btn btn-outline btn-sm faq-back">
            Back Home
          </Link>
        </header>

        <section className="faq-section legal-section">
          <h2 className="faq-section-title">Use Of The App</h2>
          <p className="faq-copy">
            My Bracket Picks is a bracket prediction tool for entertainment, private competitions,
            and tournament-style scorekeeping. You may use the app only for lawful purposes and in a
            way that does not interfere with the app or other users.
          </p>
        </section>

        <section className="faq-section legal-section">
          <h2 className="faq-section-title">Accounts</h2>
          <p className="faq-copy">
            You need to sign in with Google to save predictions. You are responsible for activity on
            your account and for making sure the information you submit is accurate enough for your
            bracket and tournament participation.
          </p>
        </section>

        <section className="faq-section legal-section">
          <h2 className="faq-section-title">Predictions And Tournaments</h2>
          <p className="faq-copy">
            Bracket rules, lock dates, scoring, access, and leaderboard visibility may vary by
            tournament. Tournament administrators may manage memberships, bracket visibility, and
            tournament settings. Predictions may become locked after a tournament deadline.
          </p>
        </section>

        <section className="faq-section legal-section">
          <h2 className="faq-section-title">Availability</h2>
          <p className="faq-copy">
            The app is provided as available. We may update, pause, or discontinue parts of the app
            at any time. We are not responsible for missed picks, incorrect predictions, scoring
            disputes, service interruptions, or third-party service issues.
          </p>
        </section>

        <section className="faq-section legal-section">
          <h2 className="faq-section-title">Third-Party Services And Trademarks</h2>
          <p className="faq-copy">
            The app uses third-party services including Google, Supabase, and GitHub Pages. My
            Bracket Picks is not affiliated with FIFA, Google, Supabase, or GitHub. FIFA World Cup
            names and related marks belong to their respective owners.
          </p>
        </section>

        <section className="faq-section legal-section">
          <h2 className="faq-section-title">Contact</h2>
          <p className="faq-copy">
            Questions about these terms can be sent to{' '}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
