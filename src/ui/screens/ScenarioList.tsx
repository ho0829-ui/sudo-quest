import type { Scenario, Category } from "../../engine/scenario/types";
import type { Progress } from "../storage";

interface ScenarioListProps {
  scenarios: Scenario[];
  progress: Progress;
  onSelect: (scenario: Scenario) => void;
  onResetProgress: () => void;
}

const CATEGORY_LABEL: Record<Category, string> = {
  linux: "리눅스",
  network: "네트워크",
  "web-db": "웹 / DB",
  aws: "AWS",
};

const DIFFICULTY_LABEL = ["", "초급", "중급", "고급"];

export function ScenarioList({ scenarios, progress, onSelect, onResetProgress }: ScenarioListProps) {
  // 카테고리별로 묶어서 보여준다
  const categories = [...new Set(scenarios.map((s) => s.category))];
  const clearedCount = scenarios.filter((s) => progress[s.id]?.cleared).length;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <span className="muted small">
          전체 {scenarios.length}개 중 {clearedCount}개 해결
        </span>
        {clearedCount > 0 && (
          <button className="small" onClick={onResetProgress}>
            진행 기록 초기화
          </button>
        )}
      </div>

      {categories.map((category) => (
        <section key={category}>
          <h2 className="category-title">{CATEGORY_LABEL[category]}</h2>
          <div className="scenario-grid">
            {scenarios
              .filter((s) => s.category === category)
              .sort((a, b) => a.difficulty - b.difficulty)
              .map((scenario) => {
                const record = progress[scenario.id];
                return (
                  <button
                    key={scenario.id}
                    className="scenario-card"
                    onClick={() => onSelect(scenario)}
                  >
                    <div className="badges">
                      <span className="badge">{DIFFICULTY_LABEL[scenario.difficulty]}</span>
                      {record?.cleared && (
                        <span className="badge cleared">해결 · {record.bestScore}점</span>
                      )}
                    </div>
                    <h3>{scenario.title}</h3>
                    <div className="small muted">{scenario.learningObjectives[0]}</div>
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
