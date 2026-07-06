import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Builder",
  description: "Job-description-driven, research-backed resume builder",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="topnav no-print">
          <Link href="/" className="brand">
            Resume<span>Builder</span>
          </Link>
          <div className="navlinks">
            <Link href="/">Generate</Link>
            <Link href="/experience">Experience Bank</Link>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
