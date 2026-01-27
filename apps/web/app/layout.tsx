import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PriceWatch",
  description: "Coupang product price monitoring",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <div className="container">
          <header className="header">
            <h1><a href="/" style={{ color: "inherit" }}>PriceWatch</a></h1>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
