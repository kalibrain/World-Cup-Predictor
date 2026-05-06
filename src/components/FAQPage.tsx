import { Link } from 'react-router-dom';

const scoringRows = [
  ['Bracket round', '1 point'],
  ['Round of 16', '2 points'],
  ['Quarterfinals', '4 points'],
  ['Semifinals', '6 points'],
  ['Final', '8 points'],
  ['Champion', '12 points'],
];

const faqItems = [
  {
    question: 'How do I make a prediction?',
    answer: 'Sign in with Google, choose a public tournament or join a private tournament by its exact name, then create a bracket. You will rank every group, select the third-place qualifiers, fill out the knockout bracket, and enter tie-breaker picks.',
  },
  {
    question: 'What do I predict in the group stage?',
    answer: 'Rank all 12 World Cup groups from first through fourth. The top two teams in each group move into the bracket automatically, and the teams you placed third become candidates for the final Round of 32 spots.',
  },
  {
    question: 'How do third-place teams work?',
    answer: 'Select exactly 8 third-place teams to qualify for the Round of 32. The app checks whether your selected combination can be assigned to valid bracket slots before it builds the knockout bracket.',
  },
  {
    question: 'What do I predict in the knockout bracket?',
    answer: 'Pick winners from the Round of 32 through the final, including the third-place match. Your final winner is your predicted champion.',
  },
  {
    question: 'What are the tie-breaker picks?',
    answer: 'Optionally enter your predicted total number of tournament goals and your predicted top scorer. The total-goals guess is used only as a tie-breaker, not as bonus scoring.',
  },
  {
    question: 'When are picks locked?',
    answer: 'Each tournament has its own lock date. After lockout, existing brackets become read-only and new picks cannot be saved for that tournament.',
  },
  {
    question: 'Can I create more than one bracket?',
    answer: 'Some tournaments allow multiple brackets per user. The landing page shows how many bracket slots you have used and how many are available.',
  },
  {
    question: 'How does autosave work?',
    answer: 'The app saves your bracket as you go after you are signed in and have selected a tournament. The save status appears on screen while changes are being persisted.',
  },
  {
    question: 'When can I see the leaderboard?',
    answer: 'The leaderboard opens after the tournament locks. Only participants with a completed bracket before lockout can view leaderboard standings and compare brackets.',
  },
  {
    question: 'Can I save or share my bracket?',
    answer: 'Once every knockout match is filled in, you can download a PDF copy of your bracket from the knockout screen. Tie-breaker picks are optional.',
  },
];

export function FAQPage() {
  return (
    <main className="app-main">
      <div className="faq-page">
        <header className="faq-header">
          <div>
            <div className="leaderboard-eyebrow">FIFA World Cup 2026</div>
            <h1 className="faq-title">FAQ</h1>
            <p className="faq-intro">
              Rules, scoring, tie-breakers, and the main features of the Bracket Predictor.
            </p>
          </div>
          <Link to="/" className="btn btn-outline btn-sm faq-back">
            Back Home
          </Link>
        </header>

        <section className="faq-section" aria-labelledby="faq-scoring-title">
          <div>
            <h2 id="faq-scoring-title" className="faq-section-title">Point System</h2>
            <p className="faq-copy">
              Points are awarded for correctly placing a team into each round. The path does not matter.
            </p>
          </div>

          <div className="faq-score-table-wrap">
            <table className="faq-score-table">
              <thead>
                <tr>
                  <th>Correct Prediction</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {scoringRows.map(([label, points]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="faq-note">
            Whether a team advances to the second round as the 1st, 2nd, or 3rd place finisher in its group does not matter. As long as you place that team into the second round, you get 1 point.
          </div>
          <div className="faq-note">
            Correctly guessing the total number of goals does not give extra points. It is used as a tie-breaker: if two people finish with equal points, the bracket with the better total-goals guess gets the advantage.
          </div>
        </section>

        <section className="faq-section" aria-labelledby="faq-items-title">
          <h2 id="faq-items-title" className="faq-section-title">Rules And Features</h2>
          <div className="faq-grid">
            {faqItems.map(item => (
              <article key={item.question} className="faq-item">
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
