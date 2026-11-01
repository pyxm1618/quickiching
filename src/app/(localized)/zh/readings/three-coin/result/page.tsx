import { redirect } from "next/navigation";
export default async function LegacyResultRedirect({searchParams}: {searchParams?: Promise<{session?:string}>}) {
  const query = searchParams ? await searchParams : undefined;
  redirect("/zh/readings/result" + (query?.session ? `?session=${encodeURIComponent(query.session)}` : ""));
}
