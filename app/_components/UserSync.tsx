"use client";

import { useAuth } from "@clerk/react";
import { useEffect } from "react";

const API_BASE_URL =
  "https://sonolii-api.g57cydy6ks.workers.dev";

export default function UserSync() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) {
      return;
    }

    let cancelled = false;

    async function syncUser() {
      try {
        const token = await getToken();

        if (!token || cancelled) {
          return;
        }

        const response = await fetch(
          `${API_BASE_URL}/users/sync`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            `User sync failed: HTTP ${response.status}`,
          );
        }

        if (!cancelled) {
          console.info("Sonolii user sync succeeded");
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Sonolii user sync error:", error);
        }
      }
    }

    void syncUser();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, getToken]);

  return null;
}
