/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { gzipSync, gunzipSync } from 'zlib';

export class BackupService {
  constructor(
    private dbAdapter: any,
    private dbPath: string,
    private backupsDir: string,
  ) {}

  public async runAutoBackup(): Promise<string | null> {
    // Check if auto backups are enabled (active by default if not set to 'false')
    const enabled = this.dbAdapter.getSetting('enable_auto_backups');
    if (enabled === 'false') {
      return null;
    }

    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }

    // Check if backup already exists for today (local time YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0];
    const files = fs.readdirSync(this.backupsDir);
    const hasTodayBackup = files.some(
      (f) => f.startsWith('emma_backup_') && f.includes(todayStr) && f.endsWith('.db.gz'),
    );

    if (hasTodayBackup) {
      return null;
    }

    // Run integrity check before backup to avoid backing up corrupted data
    const isHealthy = this.dbAdapter.checkIntegrity();
    if (!isHealthy) {
      throw new Error('Database integrity check failed');
    }

    // Read active db file and compress it
    const dbData = fs.readFileSync(this.dbPath);
    const compressed = gzipSync(dbData);

    const backupFileName = `emma_backup_${todayStr}.db.gz`;
    const backupFilePath = path.join(this.backupsDir, backupFileName);
    fs.writeFileSync(backupFilePath, compressed);

    return backupFilePath;
  }

  public rotateBackups(referenceDate: Date = new Date()): void {
    if (!fs.existsSync(this.backupsDir)) return;

    const files = fs.readdirSync(this.backupsDir);
    const backupFiles = files.filter((f) => f.startsWith('emma_backup_') && f.endsWith('.db.gz'));

    interface BackupFileInfo {
      filename: string;
      date: Date;
      dateStr: string;
    }

    const backups: BackupFileInfo[] = [];
    for (const f of backupFiles) {
      const match = f.match(/emma_backup_(\d{4}-\d{2}-\d{2})/);
      if (match) {
        const dateStr = match[1];
        const date = new Date(dateStr + 'T12:00:00Z'); // Use UTC noon to avoid local timezone shifts
        backups.push({ filename: f, date, dateStr });
      }
    }

    // Sort backups descending (newest first)
    backups.sort((a, b) => b.date.getTime() - a.date.getTime());

    const keep = new Set<string>();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Grouping weekly and monthly
    const weeklyGroups = new Map<string, BackupFileInfo[]>();
    const monthlyGroups = new Map<string, BackupFileInfo[]>();

    // ISO Week calculation helper
    const getWeekIdentifier = (date: Date): string => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${d.getUTCFullYear()}-W${weekNo}`;
    };

    for (const b of backups) {
      const ageMs = referenceDate.getTime() - b.date.getTime();

      // 1. Daily backups (Son): keep everything from the last 7 days
      if (ageMs >= 0 && ageMs < 7 * oneDayMs) {
        keep.add(b.filename);
      }

      const weekId = getWeekIdentifier(b.date);
      const monthId = `${b.date.getUTCFullYear()}-${b.date.getUTCMonth() + 1}`;

      if (!weeklyGroups.has(weekId)) weeklyGroups.set(weekId, []);
      weeklyGroups.get(weekId)!.push(b);

      if (!monthlyGroups.has(monthId)) monthlyGroups.set(monthId, []);
      monthlyGroups.get(monthId)!.push(b);
    }

    // 2. Weekly backups (Father): keep the newest backup of the last 4 weeks
    const sortedWeeks = Array.from(weeklyGroups.keys()).sort().reverse();
    const weeksToKeep = sortedWeeks.slice(0, 4);
    for (const wId of weeksToKeep) {
      const group = weeklyGroups.get(wId)!;
      group.sort((a, b) => b.date.getTime() - a.date.getTime());
      keep.add(group[0].filename);
    }

    // 3. Monthly backups (Grandfather): keep the newest backup of the last 12 months
    const sortedMonths = Array.from(monthlyGroups.keys()).sort().reverse();
    const monthsToKeep = sortedMonths.slice(0, 12);
    for (const mId of monthsToKeep) {
      const group = monthlyGroups.get(mId)!;
      group.sort((a, b) => b.date.getTime() - a.date.getTime());
      keep.add(group[0].filename);
    }

    // Delete non-compliant backups
    for (const b of backups) {
      if (!keep.has(b.filename)) {
        try {
          fs.unlinkSync(path.join(this.backupsDir, b.filename));
        } catch (err: any) {
          console.error(`Failed to delete rotated backup ${b.filename}:`, err);
        }
      }
    }
  }

  public listAutoBackups(): { filename: string; date: string; sizeBytes: number }[] {
    if (!fs.existsSync(this.backupsDir)) return [];

    const files = fs.readdirSync(this.backupsDir);
    const backupFiles = files.filter((f) => f.startsWith('emma_backup_') && f.endsWith('.db.gz'));

    const list = backupFiles.map((filename) => {
      const filePath = path.join(this.backupsDir, filename);
      const stat = fs.statSync(filePath);

      const match = filename.match(/emma_backup_(\d{4}-\d{2}-\d{2})/);
      const dateStr = match ? match[1] : new Date(stat.mtime).toISOString().split('T')[0];

      return {
        filename,
        date: dateStr,
        sizeBytes: stat.size,
      };
    });

    list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }

  public restoreAutoBackup(filename: string): boolean {
    const backupFilePath = path.join(this.backupsDir, filename);
    if (!fs.existsSync(backupFilePath)) {
      throw new Error(`Backup file ${filename} not found`);
    }

    const compressed = fs.readFileSync(backupFilePath);
    const decompressed = gunzipSync(compressed);

    // Close active db connection
    this.dbAdapter.close();

    // Overwrite emma.db
    const walPath = `${this.dbPath}-wal`;
    const shmPath = `${this.dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    fs.writeFileSync(this.dbPath, decompressed);
    return true;
  }
}
