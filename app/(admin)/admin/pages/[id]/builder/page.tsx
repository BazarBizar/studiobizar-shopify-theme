import { redirect } from "next/navigation";

/** The editor lived here once; it is the page's Content tab now. */
export default async function OldBuilderLocation({ params }: PageProps<"/admin/pages/[id]/builder">) {
  const { id } = await params;
  redirect(`/admin/pages/${id}/content`);
}
