import { Download } from "lucide-react";

export function ImportExportPanel({
  importDisabled,
  onImport,
}: {
  importDisabled: boolean;
  onImport: () => void;
}) {
  return (
    <article className="panel">
      <h2>Datos</h2>
      <p>Revisá los cambios antes de importar.</p>
      <button className="primary" disabled={importDisabled} onClick={onImport}>
        <Download size={16} />
        Importar desde Google Sheets
      </button>
      <div className="button-row">
        <a className="secondary" href="/api/export?format=xlsx">
          Exportar Excel
        </a>
        <a className="secondary" href="/api/export">
          Respaldo JSON
        </a>
        <a className="secondary" href="/api/export?format=csv">
          Exportar CSV
        </a>
      </div>
      <p className="fine-print">
        Excel y JSON incluyen todos tus juegos, páginas e historial de precios.
        CSV incluye los juegos. Guardá una copia fuera de la app.
      </p>
    </article>
  );
}
