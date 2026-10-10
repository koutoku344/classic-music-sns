"use client";

import { useEffect, useState } from "react";
import { SignIn, SignUp, useAuth } from "@clerk/react";
import { Music2 } from "lucide-react";
import type { ScreenName } from "../types";

interface AuthProps {
  navigate: (s: ScreenName) => void;
}

export default function Auth({ navigate }: AuthProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate("community");
    }
  }, [isLoaded, isSignedIn, navigate]);

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:block w-1/2 relative">
        <img
          src="https://images.pexels.com/photos/19541583/pexels-photo-19541583.jpeg?auto=compress&cs=tinysrgb&h=1200&w=900"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/30 to-ink-950/60" />
        <div className="absolute bottom-0 left-0 right-0 p-12">
          <p className="font-serif text-3xl text-white italic leading-relaxed mb-4">
            「音楽は魂の言葉であり、言葉では表現できないものを語る」
          </p>
          <p className="text-ink-300 text-sm">— Henry Wadsworth Longfellow</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-ink-50">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-10 justify-center">
            <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center">
              <Music2 size={22} className="text-white" />
            </div>
            <span className="font-serif text-2xl font-semibold text-ink-900">Sonolii</span>
          </div>

          <div className="flex gap-2 mb-6 justify-center">
            <button type="button" onClick={() => setMode("login")}
              className={`px-5 py-2 rounded-lg ${mode === "login" ? "bg-teal-600 text-white" : "bg-white text-ink-700"}`}>
              ログイン
            </button>
            <button type="button" onClick={() => setMode("register")}
              className={`px-5 py-2 rounded-lg ${mode === "register" ? "bg-teal-600 text-white" : "bg-white text-ink-700"}`}>
              新規登録
            </button>
          </div>

          <div className="flex justify-center">
            {mode === "login" ? (
              <SignIn routing="hash" fallbackRedirectUrl="/posts" />
            ) : (
              <SignUp routing="hash" fallbackRedirectUrl="/posts" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
