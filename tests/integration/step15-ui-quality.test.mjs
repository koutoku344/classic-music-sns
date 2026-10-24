import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
test('STEP15 DM empty state follows the unified profile-first flow',()=>{
 const src=read('features/sonolii/screens/Messages.tsx');
 assert.match(src,/相手のプロフィールからメッセージを始められます/);
 assert.doesNotMatch(src,/募集の承認後に開始できます/);
 assert.match(src,/一致する会話がありません/);
 assert.match(src,/!error&&visible\.length===0/);
});
test('STEP15 review lists release-blocking mock data rather than silently approving it',()=>{
 const doc=read('docs/step15-ui-quality-review.md');
 assert.match(doc,/MyPage\.tsx/);
 assert.match(doc,/モック/);
 assert.match(doc,/iPhone Safari/);
 assert.match(doc,/Android Chrome/);
});
