import type { ComponentProps } from "react";
import { AdminInvite } from "./admin-invite";
import { BackupStatus } from "./backup-status";
import { DataCheckPanel } from "./data-check-panel";
import { DriveBackupPanel } from "./drive-backup-panel";
import { ImportExportPanel } from "./import-export-panel";
import { NotificationSettings } from "./notification-settings";
import { RecentNotificationsPanel } from "./recent-notifications-panel";
import { ScoringGuide } from "./scoring-guide-panel";
import { ThemeSettings } from "./theme-settings";
import { TrashPanel } from "./trash-panel";

export function SettingsScreen({
  online,
  isAdmin,
  dataChecks,
  importExport,
  recentNotifications,
  onNotificationSettingsChanged,
  onTrashChanged,
  onInviteError,
}: {
  online: boolean;
  isAdmin: boolean;
  dataChecks: Omit<ComponentProps<typeof DataCheckPanel>, "online">;
  importExport: ComponentProps<typeof ImportExportPanel>;
  recentNotifications: ComponentProps<typeof RecentNotificationsPanel>;
  onNotificationSettingsChanged: () => void;
  onTrashChanged: () => Promise<void>;
  onInviteError: (message: string) => void;
}) {
  return (
    <div className="settings-groups">
      <section className="settings-group" aria-labelledby="settings-appearance-title">
        <div className="settings-group-heading">
          <p className="eyebrow">LECTURA</p>
          <h2 id="settings-appearance-title">Apariencia y preferencias</h2>
        </div>
        <div className="settings-grid">
          <ThemeSettings />
          <article className="panel">
            <h2>Avisos y alertas</h2>
            <NotificationSettings onChanged={onNotificationSettingsChanged} />
          </article>
        </div>
      </section>
      {online && (
        <section className="settings-group" aria-labelledby="settings-backup-title">
          <div className="settings-group-heading">
            <p className="eyebrow">COPIAS</p>
            <h2 id="settings-backup-title">Respaldos</h2>
          </div>
          <div className="settings-grid">
            <BackupStatus details />
            <DriveBackupPanel details />
          </div>
        </section>
      )}
      <section className="settings-group" aria-labelledby="settings-data-title">
        <div className="settings-group-heading">
          <p className="eyebrow">ARCHIVO</p>
          <h2 id="settings-data-title">Datos y biblioteca</h2>
        </div>
        <div className="settings-grid">
          <DataCheckPanel {...dataChecks} online={online} />
          <TrashPanel onChanged={onTrashChanged} />
          <ImportExportPanel {...importExport} />
        </div>
      </section>
      <section className="settings-group" aria-labelledby="settings-activity-title">
        <div className="settings-group-heading">
          <p className="eyebrow">SEGUIMIENTO</p>
          <h2 id="settings-activity-title">Actividad y referencias</h2>
        </div>
        <div className="settings-grid">
          <article className="panel">
            <ScoringGuide />
          </article>
          {isAdmin && (
            <article className="panel">
              <h2>Invitaciones privadas</h2>
              <p>Acceso solo por invitación.</p>
              <AdminInvite onError={onInviteError} />
            </article>
          )}
          <RecentNotificationsPanel {...recentNotifications} />
        </div>
      </section>
    </div>
  );
}
