import { useState } from "react";
import { Gamepad2, Trophy } from "lucide-react";
import DeveloperGameManagement from "./DeveloperGameManagement";
import DeveloperChallengeManagement from "./DeveloperChallengeManagement";
import "./DeveloperGamificationManagement.css";

type GamificationTab = "games" | "challenges";

export default function DeveloperGamificationManagement() {
  const [tab, setTab] = useState<GamificationTab>("games");
  const [challengesVisited, setChallengesVisited] = useState(false);
  function showChallenges() {
    setChallengesVisited(true);
    setTab("challenges");
  }
  return <div className="dev-content gamification-management">
    <header className="gamification-heading">
      <div><h1>Games &amp; Challenges Builder</h1><p>Manage game catalog entries and fitness challenges through their separate backend APIs.</p></div>
    </header>
    <nav className="gamification-tabs" aria-label="Gamification sections">
      <button type="button" className={tab === "games" ? "active" : ""} aria-current={tab === "games" ? "page" : undefined} onClick={() => setTab("games")}><Gamepad2 size={15} /> Games</button>
      <button type="button" className={tab === "challenges" ? "active" : ""} aria-current={tab === "challenges" ? "page" : undefined} onClick={showChallenges}><Trophy size={15} /> Challenges</button>
    </nav>
    <div className={tab === "games" ? "gamification-view" : "gamification-view hidden"}><DeveloperGameManagement /></div>
    {challengesVisited && <div className={tab === "challenges" ? "gamification-view" : "gamification-view hidden"}><DeveloperChallengeManagement /></div>}
  </div>;
}
