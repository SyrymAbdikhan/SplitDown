import { requireUserId } from "@/lib/supabase/server";
import { GroupView, type GroupPage } from "./group-view";

export default async function Page({ params }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const { supabase, userId } = await requireUserId();
  const { data, error } = await supabase.rpc("group_page", { p_group: id });
  if (error && !error.message.includes("not a member")) throw new Error(error.message);
  // key: a fresh view (and realtime channel) per group when navigating between groups.
  return <GroupView key={id} groupId={id} userId={userId} initial={error ? "gone" : (data as GroupPage)} />;
}
