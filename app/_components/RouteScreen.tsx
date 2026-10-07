"use client";

import { useRouter } from "next/navigation";
import type { ScreenName } from "@/features/crescendo/types";
import { conversations, notifications } from "@/features/crescendo/data";
import Header from "@/features/crescendo/components/Header";
import BottomNav from "@/features/crescendo/components/BottomNav";
import Landing from "@/features/crescendo/screens/Landing";
import Auth from "@/features/crescendo/screens/Auth";
import Community from "@/features/crescendo/screens/Community";
import PostDetail from "@/features/crescendo/screens/PostDetail";
import CreatePost from "@/features/crescendo/screens/CreatePost";
import Practice from "@/features/crescendo/screens/Practice";
import PracticeDetail from "@/features/crescendo/screens/PracticeDetail";
import CreatePractice from "@/features/crescendo/screens/CreatePractice";
import Recording from "@/features/crescendo/screens/Recording";
import RecruitmentDetail from "@/features/crescendo/screens/RecruitmentDetail";
import CreateRecruitment from "@/features/crescendo/screens/CreateRecruitment";
import Search from "@/features/crescendo/screens/Search";
import Messages from "@/features/crescendo/screens/Messages";
import Notifications from "@/features/crescendo/screens/Notifications";
import Conversation from "@/features/crescendo/screens/Conversation";
import UserProfile from "@/features/crescendo/screens/UserProfile";
import MyPage from "@/features/crescendo/screens/MyPage";
import Repertoire from "@/features/crescendo/screens/Repertoire";
import Subscription from "@/features/crescendo/screens/Subscription";
import Settings from "@/features/crescendo/screens/Settings";
import AccountSettings from "@/features/crescendo/screens/AccountSettings";
import Terms from "@/features/crescendo/screens/Terms";
import Privacy from "@/features/crescendo/screens/Privacy";
import Help from "@/features/crescendo/screens/Help";

const routeMap: Partial<Record<ScreenName, string>> = {
  landing: "/",
  auth: "/auth",
  community: "/posts",
  createPost: "/posts/new",
  practice: "/practice",
  createPractice: "/practice/new",
  recording: "/record",
  createRecruitment: "/recruitments/new",
  search: "/search",
  messages: "/messages",
  notifications: "/notifications",
  myPage: "/my-page",
  repertoire: "/my-page/repertoire",
  subscription: "/my-page/subscription",
  settings: "/settings",
  accountSettings: "/settings/account",
  terms: "/terms",
  privacy: "/privacy",
  help: "/help",
  performanceHistory: "/my-page",
};

type RouteScreenProps = {
  screen: ScreenName;
  id?: string;
};

export default function RouteScreen({ screen, id = "" }: RouteScreenProps) {
  const router = useRouter();

  const navigate = (next: ScreenName, params?: Record<string, string>) => {
    const targetId = params?.id ?? "";
    let href = routeMap[next] ?? "/posts";
    if (next === "postDetail") href = `/posts/${targetId}`;
    if (next === "practiceDetail") href = `/practice/${targetId}`;
    if (next === "recruitmentDetail") href = `/recruitments/${targetId}`;
    if (next === "conversation") href = `/messages/${targetId}`;
    if (next === "userProfile") href = `/users/${targetId}`;
    router.push(href);
    window.scrollTo(0, 0);
  };

  if (screen === "landing") return <Landing navigate={navigate} />;
  if (screen === "auth") return <Auth navigate={navigate} />;

  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const unreadMessages = conversations.filter((c) => c.unread).length;

  let content: React.ReactNode;
  switch (screen) {
    case "community": content = <Community navigate={navigate} />; break;
    case "postDetail": content = <PostDetail postId={id} navigate={navigate} />; break;
    case "createPost": content = <CreatePost navigate={navigate} />; break;
    case "practice": content = <Practice navigate={navigate} />; break;
    case "practiceDetail": content = <PracticeDetail recordId={id} navigate={navigate} />; break;
    case "createPractice": content = <CreatePractice navigate={navigate} />; break;
    case "recording": content = <Recording navigate={navigate} />; break;
    case "recruitmentDetail": content = <RecruitmentDetail recruitmentId={id} navigate={navigate} />; break;
    case "createRecruitment": content = <CreateRecruitment navigate={navigate} />; break;
    case "search": content = <Search navigate={navigate} />; break;
    case "messages": content = <Messages navigate={navigate} />; break;
    case "notifications": content = <Notifications navigate={navigate} />; break;
    case "conversation": content = <Conversation conversationId={id} navigate={navigate} />; break;
    case "userProfile": content = <UserProfile userId={id} navigate={navigate} />; break;
    case "myPage": content = <MyPage navigate={navigate} />; break;
    case "repertoire": content = <Repertoire navigate={navigate} />; break;
    case "subscription": content = <Subscription navigate={navigate} />; break;
    case "settings": content = <Settings navigate={navigate} />; break;
    case "accountSettings": content = <AccountSettings navigate={navigate} />; break;
    case "terms": content = <Terms navigate={navigate} />; break;
    case "privacy": content = <Privacy navigate={navigate} />; break;
    case "help": content = <Help navigate={navigate} />; break;
    default: content = <Community navigate={navigate} />;
  }

  return (
    <div className="min-h-screen bg-ink-50 pb-20 md:pb-0">
      <Header current={screen} navigate={navigate} unreadNotifications={unreadNotifications} unreadMessages={unreadMessages} />
      <main>{content}</main>
      <BottomNav current={screen} navigate={navigate} />
    </div>
  );
}
