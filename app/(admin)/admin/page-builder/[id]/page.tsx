import { redirect } from "next/navigation";

export default async function OldBuilderLocation({ params }: PageProps<"/admin/page-builder/[id]">) {
  const { id } = await params;
  redirect(`/admin/pages/${id}/content`);
}
