import { redirect } from "next/navigation";

/** The page builder is now each page's Content tab, under Pages. Old links land there. */
export default function OldPageBuilder() {
  redirect("/admin/pages");
}
