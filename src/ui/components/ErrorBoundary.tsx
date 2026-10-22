/**
 * 화면 한 구역에서 오류가 나도 앱 전체가 흰 화면이 되지 않게 막는다.
 * 지연 로딩 조각(실습 화면·게시판 등)을 받지 못한 경우는 새 버전 배포 직후가 대부분이라 새로고침을 안내한다.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** 오류 안내에 쓰는 구역 이름(예: "실습 화면") */
  label: string;
  /** 이 값이 바뀌면(다른 화면으로 이동) 오류 상태를 풀고 다시 그린다. */
  resetKey?: string;
  /** 좁은 구역(코치 패널 등)은 짧은 안내만 보인다. */
  compact?: boolean;
  children: ReactNode;
}

interface State { error: Error | null }

const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \S+ failed/i;

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_ERROR.test(error.message);
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 화면에는 사용자용 안내만, 개발자용 자세한 내용은 콘솔에 남긴다.
    console.error(`[${this.props.label}] 화면 오류`, error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkLoadError(error);
    const reset = () => this.setState({ error: null });
    return <section className={`crash-panel ${this.props.compact ? "compact" : ""}`} role="alert">
      <p className="crash-code">{chunk ? "UPDATE AVAILABLE" : "PANEL FAULT"} · {this.props.label}</p>
      <h2>{chunk ? "새 버전이 배포되어 화면 일부를 불러오지 못했어요" : `${this.props.label}에서 오류가 났어요`}</h2>
      {!this.props.compact && <p className="muted small">{chunk
        ? "새로고침하면 최신 화면으로 이어집니다. 진행 중이던 실습은 탭에 저장되어 있어요."
        : "다른 화면과 학습 기록은 그대로입니다. 다시 시도해도 같다면 홈으로 돌아가 주세요."}</p>}
      <div className="crash-actions">
        {chunk
          ? <button className="primary" onClick={() => window.location.reload()}>새로고침</button>
          : <button className="primary" onClick={reset}>다시 시도</button>}
        {!this.props.compact && <button className="text-button" onClick={() => { window.location.hash = "#/"; reset(); }}>홈으로</button>}
      </div>
    </section>;
  }
}
