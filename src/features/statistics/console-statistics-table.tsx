import type { statistics } from "./statistics";

export function ConsoleStatisticsTable({
  consoles,
  empty,
  formatNumber,
}: {
  consoles: ReturnType<typeof statistics>["consoles"];
  empty: boolean;
  formatNumber: (value: number | null, suffix?: string) => string;
}) {
  return (
    <article className="panel">
      <h2>Por consola</h2>
      <table>
        <thead>
          <tr>
            <th>Consola</th>
            <th>Partidas</th>
            <th>Horas registradas</th>
          </tr>
        </thead>
        <tbody>
          {consoles.map((item) => (
            <tr key={item.name}>
              <td>{item.name}</td>
              <td>{item.count}</td>
              <td>{formatNumber(item.hours, " h")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {empty && <p className="muted">Sin partidas para este año.</p>}
    </article>
  );
}
