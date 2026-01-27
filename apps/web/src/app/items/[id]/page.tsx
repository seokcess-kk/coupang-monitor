import { getBaseUrl } from "@/lib/base-url";

type PageProps = {
  params: { id: string };
};

export default async function ItemDetailPage({ params }: PageProps) {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/api/items/${params.id}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    return <div>아이템을 찾을 수 없습니다.</div>;
  }
  const data = await response.json();

  return (
    <>
      <section>
        <h2>{data.item.name ?? "Untitled"}</h2>
        <p className="muted">{data.item.url}</p>
        <div className="flex">
          <span className="tag">{data.item.status}</span>
          <span className="muted">
            마지막 체크: {data.item.lastCheckedAt ?? "-"}
          </span>
        </div>
        <div className="flex" style={{ marginTop: "12px" }}>
          <span>현재 최저가: {data.item.current_low ?? "-"}</span>
          <span>7D 최저: {data.item.low_7d ?? "-"}</span>
          <span>30D 최저: {data.item.low_30d ?? "-"}</span>
        </div>
      </section>

      <section>
        <h2>30일 가격 추이</h2>
        {data.series.length === 0 ? (
          <p className="muted">수집된 데이터가 없습니다.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>최저가</th>
              </tr>
            </thead>
            <tbody>
              {data.series.map((row: { date: string; price: number }) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{row.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>옵션 목록</h2>
        <table>
          <thead>
            <tr>
              <th>옵션</th>
              <th>활성</th>
            </tr>
          </thead>
          <tbody>
            {data.variants.map((variant: { id: string; optionKey: string; active: boolean }) => (
              <tr key={variant.id}>
                <td>{variant.optionKey}</td>
                <td>{variant.active ? "Y" : "N"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
