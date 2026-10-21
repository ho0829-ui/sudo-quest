import { copyFile, chmod } from 'node:fs/promises';
import { constants } from 'node:fs';

// 설정 파일 생성 전용 개발 도구. 게임의 가상 명령 실행과 무관합니다.
for (const path of ['.env', 'backend/.env']) {
  const target = new URL(`../${path}`, import.meta.url);
  try {
    await copyFile(new URL(`../${path}.example`, import.meta.url), target, constants.COPYFILE_EXCL);
    await chmod(target, 0o600);
    console.log(`생성: ${path}`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`유지: ${path} (기존 설정을 변경하지 않았습니다)`);
  }
}
console.log('backend/.env의 GMS_KEY에 키를 입력하세요. 프론트엔드에는 키를 넣지 마세요.');
