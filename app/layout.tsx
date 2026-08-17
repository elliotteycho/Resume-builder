import type { Metadata } from "next";
import Link from "next/link";
import { isMultiUser } from "@/lib/hq/mode";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internship HQ",
  description:
    "A recruiting CRM for students: track the season, match your experience to postings, and find the warm connection.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="topnav no-print">
          <Link href="/" className="brand">
            Internship<span>HQ</span>
          </Link>
          <div className="navlinks">
            <Link href="/">Tracker</Link>
            <Link href="/profile">Profile</Link>
            <Link href="/generate">Generate resume</Link>
            <Link href="/experience">Evidence</Link>
            {isMultiUser() && <a href="/auth/signout">Sign out</a>}
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
