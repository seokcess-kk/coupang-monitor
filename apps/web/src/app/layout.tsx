import "./globals.css";

export const metadata = {
  title: "PriceWatch MVP",
  description: "Coupang price monitor MVP"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <main>
          <header style={{ marginBottom: "20px" }}>
            <h1>PriceWatch MVP</h1>
            <p className="muted">
              쿠팡 상품 표시가 모니터링 (확장 프로그램 기반 스크래핑)
            </p>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
