export default function StatCard({ label, value, hint }) {
  return (
    <div className="panel stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="muted">{hint}</div> : null}
    </div>
  );
}
