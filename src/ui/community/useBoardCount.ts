import { useEffect, useState } from 'react';
import { boardRequest, isPostPage } from '../../api/community';

/**
 * 레일 배지에 쓸 실제 게시글 수. 화면(워크스페이스)이 바뀔 때마다 다시 센다.
 * 백엔드가 꺼져 있으면 null — 배지는 "–"로 두고 게임은 그대로 쓴다.
 */
export function useBoardCount(refreshKey: string): number | null {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    boardRequest('/posts?page=1&page_size=1', isPostPage, undefined, controller.signal)
      .then(page => setCount(page.total))
      .catch(() => { if (!controller.signal.aborted) setCount(null); });
    return () => controller.abort();
  }, [refreshKey]);
  return count;
}
