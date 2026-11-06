import type { Metadata } from "next";
import { PhoneFrame } from "@/components/app/PhoneFrame";

export const metadata: Metadata = { title: "NatWest (concept)" };

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return <PhoneFrame>{children}</PhoneFrame>;
}
