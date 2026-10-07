"use client";
import { useParams } from "next/navigation";
import RouteScreen from "../../_components/RouteScreen";
export default function Page(){const p=useParams<{conversationId:string}>();return <RouteScreen screen="conversation" id={p.conversationId} />;}
