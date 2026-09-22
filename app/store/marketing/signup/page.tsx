// Route: /store/marketing/signup
// Not a real page -- BizNest Marketing signup lives at /marketing/signup
// (see app/marketing/signup/page.tsx). This route exists only so old links
// or typed URLs at /store/marketing/signup (easy to guess from the sibling
// /store/marketing workspace route) land somewhere useful instead of 404ing.
import { redirect } from "next/navigation";

export default function StoreMarketingSignupRedirect() {
  redirect("/marketing/signup");
}