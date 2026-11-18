import { recapMonthName } from "../recap-export";
import type { RecapPeriod } from "../recaps";
import styles from "./recap-builder.module.css";

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: recapMonthName(index + 1),
}));

export function RecapPeriodControls({
  period,
  yearOptions,
  onTypeChange,
  onMonthChange,
  onYearChange,
}: {
  period: RecapPeriod;
  yearOptions: number[];
  onTypeChange: (type: RecapPeriod["type"]) => void;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}) {
  return (
    <div className={styles.controls}>
      <label>
        Período
        <select
          value={period.type}
          onChange={(event) =>
            onTypeChange(event.target.value as RecapPeriod["type"])
          }
        >
          <option value="month">Mes</option>
          <option value="year">Año</option>
        </select>
      </label>
      {period.type === "month" && (
        <label>
          Mes del resumen
          <select
            aria-label="Mes del resumen"
            value={period.month}
            onChange={(event) => onMonthChange(Number(event.target.value))}
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Año del resumen
        <select
          aria-label="Año del resumen"
          value={period.year}
          onChange={(event) => onYearChange(Number(event.target.value))}
        >
          {yearOptions.map((year) => (
            <option key={year}>{year}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
