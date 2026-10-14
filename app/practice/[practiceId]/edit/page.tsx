"use client";
import { useParams } from "next/navigation";
import RouteScreen from "../../../_components/RouteScreen";
export default function Page() {
  const params = useParams<{ practiceId: string }>();
  return <RouteScreen screen="createPractice" id={params.practiceId} />;
}
