"use client";
import { useParams } from "next/navigation";
import RouteScreen from "../../_components/RouteScreen";
export default function Page(){const p=useParams<{postId:string}>();return <RouteScreen screen="postDetail" id={p.postId} />;}
