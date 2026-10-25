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

test('STEP15 MyPage avoids fabricated social, trophy, premium and recruitment data',()=>{
 const src=read('features/sonolii/screens/MyPage.tsx');
 assert.doesNotMatch(src,/from '\.\.\/data'/);
 assert.doesNotMatch(src,/me\.followers|me\.following|me\.trophies/);
 assert.doesNotMatch(src,/20GB・長期保存/);
 assert.match(src,/listMyRecruitments/);
 assert.match(src,/recruitmentsCursor/);
 assert.match(src,/自分が作成した募集はありません/);
});

test('STEP15 own recruitment route is authenticated and scoped to the owner',()=>{
 const index=read('backend/src/index.ts');
 const api=read('backend/src/recruitments.ts');
 assert.match(index,/url.pathname === "\/me\/recruitments"/);
 assert.match(api,/if\(!userId\)return resp\(\{error:"unauthorized"\},401,headers\)/);
 assert.match(api,/WHERE r.user_id=\$\{userId\}::uuid/);
});

test('STEP15 requested copy updates and community header cleanup',()=>{
 const community=read('features/sonolii/screens/Community.tsx');
 assert.doesNotMatch(community,/投稿 \{posts.length\}件（取得済み）/);
 assert.match(community,/status === "open"/);
 const post=read('features/sonolii/screens/CreatePost.tsx');
 assert.match(post,/コメント受付/);
 assert.doesNotMatch(post,/コメント受付（将来の交流機能用）/);
 const recruiting=read('features/sonolii/screens/CreateRecruitment.tsx');
 assert.match(recruiting,/label="演奏曲目"/);
 assert.match(recruiting,/募集内容 <span aria-label="必須"/);
});

test('STEP15 practice monthly charts and repertoire counters',()=>{
 const practice=read('features/sonolii/screens/Practice.tsx');
 const donut=read('features/sonolii/components/PracticeDonut.tsx');
 const mypage=read('features/sonolii/screens/MyPage.tsx');
 assert.match(practice,/monthBounds\(currentMonth.year,currentMonth.month\)/);
 assert.match(practice,/view === 'date'/);
 assert.match(practice,/<PracticeDonut items=\{chartItems\}/);
 assert.match(donut,/conic-gradient/);
 assert.match(donut,/aria-label/);
 assert.match(mypage,/練習中 \{myRepertoire.filter/);
 assert.doesNotMatch(mypage,/取得済み投稿数/);
});

test('STEP15 post images support previous, next and touch swipe',()=>{
 const src=read('features/sonolii/components/PostMediaView.tsx');
 assert.match(src,/aria-label="前の画像"/);
 assert.match(src,/aria-label="次の画像"/);
 assert.match(src,/onTouchStart/);
 assert.match(src,/onTouchEnd/);
 assert.doesNotMatch(src,/shownImages\.map/);
});
