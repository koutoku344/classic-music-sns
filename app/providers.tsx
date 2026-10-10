"use client";

import { ClerkProvider } from "@clerk/react";
import UserSync from "./_components/UserSync";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not configured",
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <UserSync />
      {children}
    </ClerkProvider>
  );
}