"use client";
import { useParams } from "next/navigation";
import RouteScreen from "../../_components/RouteScreen";
export default function Page(){const p=useParams<{userId:string}>();return <RouteScreen screen="userProfile" id={p.userId} />;}
