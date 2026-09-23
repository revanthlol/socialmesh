const architecture = [
  ["Web", "React on Vercel"],
  ["API", "Express on the Oracle VPS"],
  ["Data", "Neon PostgreSQL via Prisma"],
  ["Jobs", "Upstash QStash rolling scheduler"],
  ["Media", "Cloudflare R2"],
] as const;

export function App() {
  return (
    <main className="shell">
      <section aria-labelledby="page-title" className="panel">
        <p className="eyebrow">SociaMesh bootstrap</p>
        <h1 id="page-title">The project is wired and ready for implementation.</h1>
        <p className="lede">
          This screen is deliberately minimal. Build the authenticated dashboard from the
          requirements in PRD.md, then replace this bootstrap route.
        </p>

        <dl className="architecture">
          {architecture.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
