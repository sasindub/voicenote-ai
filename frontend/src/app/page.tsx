import { redirect } from "next/navigation";

// The app's home → send straight to the inquiries dashboard.
export default function Home() {
  redirect("/dashboard/inquiries");
}
