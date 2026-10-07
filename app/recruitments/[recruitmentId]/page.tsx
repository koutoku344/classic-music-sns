"use client";
import { useParams } from "next/navigation";
import RouteScreen from "../../_components/RouteScreen";
export default function Page(){const p=useParams<{recruitmentId:string}>();return <RouteScreen screen="recruitmentDetail" id={p.recruitmentId} />;}
