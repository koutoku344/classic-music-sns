"use client";
import { useParams } from "next/navigation";
import RouteScreen from "../../_components/RouteScreen";
export default function Page(){const p=useParams<{practiceId:string}>();return <RouteScreen screen="practiceDetail" id={p.practiceId} />;}
