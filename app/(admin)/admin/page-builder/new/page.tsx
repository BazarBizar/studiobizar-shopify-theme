import { redirect } from "next/navigation";

export default function OldNewPage() {
  redirect("/admin/pages/new");
}
