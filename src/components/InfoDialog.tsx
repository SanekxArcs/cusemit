import { ExternalLink, Moon } from 'lucide-react';
import { Panel, Section } from './ui/controls';
import { SyncSection } from './SyncSection';

export function InfoDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Panel
      open={isOpen}
      onClose={onClose}
      title="Cusemit"
      description="Your time. Your space. Your clock."
    >
      <div className="amoled-preview">
        <Moon size={30} />
        <span>A clock that feels like yours.</span>
        <small>Made by Sanekx</small>
      </div>
      <Section title="Make it your own">
        <p className="setting-note">
          Use the side buttons to change your typeface, colors, texture, and
          display. Automatic positioning fits the visible numbers to your
          screen. Manual and floating modes give you direct control.
        </p>
      </Section>
      <Section title="At home on your screen">
        <p className="setting-note">
          Install Cusemit from your browser for a fullscreen clock. The screen
          stays awake when your browser supports it. Touch the screen to reveal
          hidden controls.
        </p>
      </Section>
      <SyncSection />
      <Section title="Ready without internet">
        <p className="setting-note">
          Once the app has finished loading online, it can reopen offline. Save
          fonts in Clock and upload a background to keep them on this device.
          Clearing browser data also removes your saved settings, images, and
          fonts.
        </p>
      </Section>
      <Section title="AMOLED">
        <p className="setting-note">
          Pure black turns off dark OLED pixels. Pixel shift and mesh provide
          optional screen protection. Keep brightness comfortable; these
          features cannot guarantee against burn-in.
        </p>
      </Section>
      <a
        className="ui-button ui-button-outline"
        href="https://github.com/SanekxArcs/cusemit"
        target="_blank"
        rel="noreferrer"
      >
        View source <ExternalLink size={15} />
      </a>
    </Panel>
  );
}
