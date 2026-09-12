import React from 'react';
import {
  Check,
  Cloud,
  CloudDownload,
  CloudOff,
  CloudUpload,
  Copy,
  TriangleAlert,
  Unlink,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Section } from './ui/controls';
import { useSettingsStore } from '@/store/settings';
import {
  formatCode,
  serializeSyncable,
  normalizeCode,
} from '@/lib/syncableSettings';
import { hasLocalChanges, isSyncConfigured, useSyncStore } from '@/store/sync';

function relativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function SyncSection() {
  const settings = useSettingsStore((state) => state.settings);
  const { link, busy, error, conflict, createCode, connect, upload, download, disconnect } =
    useSyncStore();
  const [entry, setEntry] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);

  const payload = React.useMemo(() => serializeSyncable(settings), [settings]);
  const dirty = hasLocalChanges(link, payload);
  const working = busy !== 'idle';

  if (!isSyncConfigured) {
    return (
      <Section title="Sync across devices">
        <p className="setting-note">
          <CloudOff size={15} /> Sync is unavailable in this build.
        </p>
      </Section>
    );
  }

  async function copyCode() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(formatCode(link.code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Copying is blocked here. Type the code by hand.');
    }
  }

  return (
    <Section title="Sync across devices">
      <p className="setting-note">
        Share your AMOLED, Background, Clock, and Display settings with another
        device using a code. Positioning, timers, and your background image stay
        on this device. Nothing uploads or downloads on its own — only when you
        press a button here.
      </p>

      {link === null ? (
        <>
          <Button
            variant="default"
            disabled={working}
            onClick={() => void createCode()}
          >
            <Cloud size={16} />
            {busy === 'creating' ? 'Creating code…' : 'Create a sync code'}
          </Button>
          <p className="setting-note">Already have a code from another device?</p>
          <div className="sync-entry">
            <Input
              aria-label="Sync code"
              placeholder="ABCD-EFGH"
              spellCheck={false}
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={9}
              value={entry}
              onChange={(e) => setEntry(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && normalizeCode(entry).length === 8) {
                  void connect(entry);
                }
              }}
            />
            <Button
              variant="secondary"
              disabled={working || normalizeCode(entry).length !== 8}
              onClick={() => void connect(entry)}
            >
              {busy === 'connecting' ? 'Connecting…' : 'Use code'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="sync-code">
            <div>
              <span className="field-label">Your sync code</span>
              <strong>{formatCode(link.code)}</strong>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Copy sync code"
              onClick={() => void copyCode()}
            >
              {copied ? <Check size={17} /> : <Copy size={17} />}
            </Button>
          </div>

          <p className="setting-note">
            {dirty
              ? 'This device has changes that have not been uploaded.'
              : link.syncedAt > 0
                ? `Up to date — last synced ${relativeTime(link.syncedAt)}.`
                : 'Up to date.'}
          </p>

          {conflict && (
            <div className="inline-notice">
              <TriangleAlert size={18} />
              <p>
                Another device uploaded newer settings. Download them, or upload
                again to replace them.
              </p>
            </div>
          )}

          <div className="sync-actions">
            <Button
              variant="default"
              disabled={working || (!dirty && !conflict)}
              onClick={() => void upload({ force: conflict })}
            >
              <CloudUpload size={16} />
              {busy === 'pushing'
                ? 'Uploading…'
                : conflict
                  ? 'Upload anyway'
                  : dirty
                    ? 'Upload changes'
                    : 'Nothing to upload'}
            </Button>
            <Button
              variant="secondary"
              disabled={working}
              onClick={() => void download()}
            >
              <CloudDownload size={16} />
              {busy === 'pulling' ? 'Downloading…' : 'Download settings'}
            </Button>
          </div>

          {dirty && (
            <p className="setting-note">
              Downloading replaces the unsaved changes on this device.
            </p>
          )}

          {confirmDisconnect ? (
            <div className="reset-confirm">
              <p>Stop using this code on this device? Your settings stay as they are.</p>
              <Button
                variant="default"
                onClick={() => {
                  disconnect();
                  setConfirmDisconnect(false);
                  setEntry('');
                  toast.success('This device is no longer synced');
                }}
              >
                Disconnect
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDisconnect(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="small"
              disabled={working}
              onClick={() => setConfirmDisconnect(true)}
            >
              <Unlink size={15} /> Disconnect this device
            </Button>
          )}
        </>
      )}

      {error && (
        <p className="setting-note sync-error" role="alert">
          {error}
        </p>
      )}
    </Section>
  );
}
