import { useState } from 'react';
import type { ScreenName } from './types';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Landing from './screens/Landing';
import Auth from './screens/Auth';
import Community from './screens/Community';
import PostDetail from './screens/PostDetail';
import CreatePost from './screens/CreatePost';
import Practice from './screens/Practice';
import PracticeDetail from './screens/PracticeDetail';
import CreatePractice from './screens/CreatePractice';
import Recording from './screens/Recording';
import RecruitmentDetail from './screens/RecruitmentDetail';
import CreateRecruitment from './screens/CreateRecruitment';
import Search from './screens/Search';
import Messages from './screens/Messages';
import Notifications from './screens/Notifications';
import Conversation from './screens/Conversation';
import UserProfile from './screens/UserProfile';
import MyPage from './screens/MyPage';
import Repertoire from './screens/Repertoire';
import PerformanceHistory from './screens/PerformanceHistory';
import Subscription from './screens/Subscription';
import Settings from './screens/Settings';
import AccountSettings from './screens/AccountSettings';
import Terms from './screens/Terms';
import Privacy from './screens/Privacy';
import Help from './screens/Help';
import { notifications, conversations } from './data';

function App() {
  const [screen, setScreen] = useState<ScreenName>('landing');
  const [params, setParams] = useState<Record<string, string>>({});

  const navigate = (s: ScreenName, p?: Record<string, string>) => {
    setScreen(s);
    setParams(p || {});
    window.scrollTo(0, 0);
  };

  const isPublicPage = screen === 'landing' || screen === 'auth';
  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const unreadMessages = conversations.filter((c) => c.unread).length;

  if (isPublicPage) {
    if (screen === 'landing') return <Landing navigate={navigate} />;
    return <Auth navigate={navigate} />;
  }

  return (
    <div className="min-h-screen bg-ink-50 pb-20 md:pb-0">
      <Header current={screen} navigate={navigate} unreadNotifications={unreadNotifications} unreadMessages={unreadMessages} />
      <main>
        {screen === 'community' && <Community navigate={navigate} />}
        {screen === 'postDetail' && <PostDetail postId={params.id || ''} navigate={navigate} />}
        {screen === 'createPost' && <CreatePost navigate={navigate} />}
        {screen === 'practice' && <Practice navigate={navigate} />}
        {screen === 'practiceDetail' && <PracticeDetail recordId={params.id || ''} navigate={navigate} />}
        {screen === 'createPractice' && <CreatePractice navigate={navigate} />}
        {screen === 'recording' && <Recording navigate={navigate} />}
        {screen === 'recruitmentDetail' && <RecruitmentDetail recruitmentId={params.id || ''} navigate={navigate} />}
        {screen === 'createRecruitment' && <CreateRecruitment navigate={navigate} />}
        {screen === 'search' && <Search navigate={navigate} />}
        {screen === 'messages' && <Messages navigate={navigate} />}
        {screen === 'notifications' && <Notifications navigate={navigate} />}
        {screen === 'conversation' && <Conversation conversationId={params.id || ''} navigate={navigate} />}
        {screen === 'userProfile' && <UserProfile userId={params.id || ''} navigate={navigate} />}
        {screen === 'myPage' && <MyPage navigate={navigate} />}
        {screen === 'repertoire' && <Repertoire navigate={navigate} />}
        {screen === 'performanceHistory' && <PerformanceHistory navigate={navigate} />}
        {screen === 'subscription' && <Subscription navigate={navigate} />}
        {screen === 'settings' && <Settings navigate={navigate} />}
        {screen === 'accountSettings' && <AccountSettings navigate={navigate} />}
        {screen === 'terms' && <Terms navigate={navigate} />}
        {screen === 'privacy' && <Privacy navigate={navigate} />}
        {screen === 'help' && <Help navigate={navigate} />}
      </main>
      <BottomNav current={screen} navigate={navigate} />
    </div>
  );
}

export default App;
