"use client";

export default function ItemTableSkeleton() {
  return (
    <div className="card" style={{ padding: 0, overflow: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Current Low</th>
            <th>7D Low</th>
            <th>30D Low</th>
            <th>Lowest Option</th>
            <th>Status</th>
            <th>Variants</th>
            <th>Last Checked</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {[...Array(5)].map((_, i) => (
            <tr key={i}>
              <td><div className="skeleton skeleton-text" style={{ width: 180 }} /></td>
              <td><div className="skeleton skeleton-price" /></td>
              <td><div className="skeleton skeleton-price" /></td>
              <td><div className="skeleton skeleton-price" /></td>
              <td><div className="skeleton skeleton-text" style={{ width: 100 }} /></td>
              <td><div className="skeleton skeleton-badge" /></td>
              <td><div className="skeleton skeleton-text" style={{ width: 30 }} /></td>
              <td><div className="skeleton skeleton-text" style={{ width: 100 }} /></td>
              <td><div className="skeleton skeleton-button" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
