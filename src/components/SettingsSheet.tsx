import React from 'react';
import {
  Moon,
  Palette,
  Type,
  Monitor,
  Scan,
  Timer,
  Info,
  RotateCcw,
  Upload,
  Expand,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettingsStore, type ClockSettings } from '@/store/settings';
import { CURATED_FONTS, normalizeFont } from '@/lib/fonts';
import {
  Button,
  Color,
  Input,
  Panel,
  Range,
  Section,
  Segments,
  Toggle,
} from './ui/controls';
import { FontBrowser } from './FontBrowser';

export type SettingsSection =
  'amoled' | 'background' | 'clock' | 'display' | 'position';
const sections = [
  {
    id: 'amoled',
    title: 'AMOLED',
    icon: Moon,
    description: 'A quieter clock for your OLED screen.',
  },
  {
    id: 'background',
    title: 'Background',
    icon: Palette,
    description: 'Set the atmosphere behind your time.',
  },
  {
    id: 'clock',
    title: 'Clock',
    icon: Type,
    description: 'Find the typeface that feels like you.',
  },
  {
    id: 'display',
    title: 'Display',
    icon: Monitor,
    description: 'Choose what your clock tells you.',
  },
  {
    id: 'position',
    title: 'Positioning',
    icon: Scan,
    description: 'Give your time the space it deserves.',
  },
] as const;

export function SettingsRail({
  section,
  onChange,
  visible,
  onTimer,
  onInfo,
}: {
  section: SettingsSection | null;
  onChange: (s: SettingsSection | null) => void;
  visible: boolean;
  onTimer: () => void;
  onInfo: () => void;
}) {
  return (
    <nav
      aria-label="Clock settings"
      className={'settings-rail ' + (!visible && !section ? 'rail-hidden' : '')}
    >
      {sections.map((s) => (
        <Button
          key={s.id}
          variant="ghost"
          className={section === s.id ? 'rail-active' : ''}
          aria-label={s.title + ' settings'}
          title={s.title}
          aria-expanded={section === s.id}
          onClick={() => onChange(section === s.id ? null : s.id)}
        >
          <s.icon size={19} />
          <span>{s.title === 'Positioning' ? 'Position' : s.title}</span>
        </Button>
      ))}
      <div className="rail-divider" />
      <Button variant="ghost" aria-label="Timers" onClick={onTimer}>
        <Timer size={18} />
        <span>Timers</span>
      </Button>
      <Button variant="ghost" aria-label="About Cusemit" onClick={onInfo}>
        <Info size={18} />
        <span>About</span>
      </Button>
    </nav>
  );
}

export function SettingsSheet({
  section,
  onClose,
}: {
  section: SettingsSection | null;
  onClose: () => void;
}) {
  const {
    settings: s,
    updateSetting: update,
    updateMultiple,
    resetToDefaults,
  } = useSettingsStore();
  const [resetting, setResetting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const current = sections.find((item) => item.id === section) ?? sections[2];
  const number = (
    key: keyof ClockSettings,
    label: string,
    min: number,
    max: number,
    step = 1,
    unit = ''
  ) => (
    <Range
      label={label}
      value={s[key] as number}
      min={min}
      max={max}
      step={step}
      unit={unit}
      onChange={(v) => update(key, v)}
    />
  );
  const toggle = (
    key: keyof ClockSettings,
    label: string,
    description?: string
  ) => (
    <Toggle
      label={label}
      description={description}
      checked={s[key] as boolean}
      onChange={(v) => update(key, v)}
    />
  );
  const color = (key: keyof ClockSettings, label: string) => (
    <Color
      label={label}
      value={s[key] as string}
      onChange={(v) => update(key, v)}
    />
  );
  const curated = CURATED_FONTS.find(
    (f) => f.label === normalizeFont(s.customFontFamily || s.fontFamily)
  );
  const weights = curated?.weights ?? [400, 500, 600, 700, 800, 900];
  const position = s.clockFloating ? 'floating' : s.autoFit ? 'auto' : 'manual';

  async function upload(file?: File) {
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(
        file.type
      )
    ) {
      toast.error('Choose a PNG, JPEG, WebP, or GIF image.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Choose an image smaller than 20 MB.');
      return;
    }
    setUploading(true);
    try {
      // Resize imported images before persisting: full camera photos easily
      // exhaust localStorage and would otherwise break all setting saves.
      const bitmap = await createImageBitmap(file);
      const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      canvas
        .getContext('2d')!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const image = canvas.toDataURL('image/webp', 0.8);
      if (image.length > 2_000_000)
        throw new Error(
          'Image is too detailed to save. Choose a smaller image.'
        );
      const updates = {
        backgroundImage: image,
        ...(s.enableAMOLEDSaver
          ? { backgroundPattern: 'image' as const }
          : { backgroundMode: 'image' as const }),
      };
      localStorage.setItem(
        'app.clock.settings.v1',
        JSON.stringify({ ...s, ...updates })
      );
      updateMultiple(updates);
      toast.success('Background saved on this device');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not save this image.'
      );
    } finally {
      setUploading(false);
    }
  }
  const imageControls = (
    <>
      <label className="upload-button">
        <Upload size={17} />
        {uploading ? 'Saving image…' : 'Upload an image'}
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label="Upload background image"
          disabled={uploading}
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      <p className="setting-note">Stored on this device for offline use.</p>
      {s.backgroundImage && (
        <>
          <img
            className="background-thumbnail"
            src={s.backgroundImage}
            alt="Your background"
          />
          {number('bgScale', 'Image zoom', 1, 4, 0.05, '×')}
          {number('bgOffsetX', 'Image horizontal position', 0, 100, 1, '%')}
          {number('bgOffsetY', 'Image vertical position', 0, 100, 1, '%')}
          <Button
            variant="ghost"
            size="small"
            onClick={() => update('backgroundImage', '')}
          >
            Remove image
          </Button>
        </>
      )}
    </>
  );

  return (
    <Panel
      open={section !== null}
      onClose={onClose}
      title={current.title}
      description={current.description}
      footer={
        <>
          <span>
            <span className="saved-dot" /> Changes save automatically
          </span>
          <Button variant="ghost" size="small" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {section === 'amoled' && (
        <>
          <div className="amoled-preview">
            <Moon size={30} />
            <span>Less light. More focus.</span>
            <small>Pure black, with room for a little texture.</small>
          </div>
          {toggle(
            'enableAMOLEDSaver',
            'AMOLED mode',
            'Use a pure black base and screen protection.'
          )}
          {s.enableAMOLEDSaver && (
            <Section title="Screen protection">
              <Segments
                label="Protection method"
                value={s.amoledSaverMode}
                onChange={(v) => update('amoledSaverMode', v)}
                options={[
                  { value: 'drift', label: 'Pixel shift' },
                  { value: 'mesh', label: 'Pixel mesh' },
                ]}
              />
              {s.amoledSaverMode === 'mesh' && (
                <Segments
                  label="Mesh pattern"
                  value={s.amoledMeshType}
                  onChange={(v) => update('amoledMeshType', v)}
                  options={[
                    { value: 'pixel', label: 'Pixels' },
                    { value: 'v-lines', label: 'Vertical' },
                    { value: 'h-lines', label: 'Horizontal' },
                  ]}
                />
              )}
              <p className="setting-note">
                Pixel shift gently moves the clock every minute. Background
                textures stay optional in Background. Lit textures use more
                power than pure black.
              </p>
            </Section>
          )}
        </>
      )}
      {section === 'background' && (
        <>
          {s.enableAMOLEDSaver ? (
            <div className="inline-notice">
              <Moon size={18} />
              <div>
                <strong>AMOLED is on</strong>
                <p>
                  Your base stays pure black. Add a subtle pattern or your own
                  image below.
                </p>
              </div>
            </div>
          ) : (
            <Section title="Base background">
              <Segments
                label="Background style"
                value={s.backgroundMode}
                onChange={(v) => update('backgroundMode', v)}
                options={[
                  { value: 'solid', label: 'Solid' },
                  { value: 'gradient', label: 'Gradient' },
                  { value: 'image', label: 'Image' },
                ]}
              />
              {s.backgroundMode === 'solid' &&
                color('solidColor', 'Background color')}
              {s.backgroundMode === 'gradient' && (
                <>
                  {color('gradientStart', 'Start color')}
                  {color('gradientEnd', 'End color')}
                  {number('bgGradientAngle', 'Gradient angle', 0, 360, 1, '°')}
                  {toggle('animatedGradient', 'Animate gradient')}
                </>
              )}
              {s.backgroundMode === 'image' && imageControls}
            </Section>
          )}
          <Section title="Texture">
            <div className="pattern-grid">
              {(['none', 'dots', 'grid', 'diagonal', 'image'] as const).map(
                (p) => (
                  <Button
                    key={p}
                    variant="outline"
                    className={
                      'pattern-choice ' +
                      (s.backgroundPattern === p ? 'selected' : '')
                    }
                    aria-pressed={s.backgroundPattern === p}
                    onClick={() => update('backgroundPattern', p)}
                  >
                    <span className={'pattern-sample pattern-' + p}>
                      {p === 'image' && <Upload size={18} />}
                    </span>
                    <span>
                      {p === 'none'
                        ? 'Clean'
                        : p === 'image'
                          ? 'Your image'
                          : p[0].toUpperCase() + p.slice(1)}
                    </span>
                  </Button>
                )
              )}
            </div>
            {s.backgroundPattern !== 'none' && (
              <>
                {number('patternOpacity', 'Texture opacity', 0.02, 1, 0.01)}
                {s.backgroundPattern === 'image'
                  ? imageControls
                  : number('patternSize', 'Pattern spacing', 8, 100, 1, 'px')}
              </>
            )}
          </Section>
        </>
      )}
      {section === 'clock' && (
        <>
          <FontBrowser />
          <Section title="Typography">
            {/* A font with a single weight has nothing to choose between. */}
            {weights.length > 1 && (
              <Segments
                label="Font weight"
                // Fonts ship anywhere from two weights to six; lay them out on
                // the divisor that leaves no half-empty row.
                columns={weights.length % 3 === 0 ? 3 : 2}
                value={String(s.fontWeight)}
                onChange={(v) => update('fontWeight', Number(v))}
                options={weights.map((w) => ({
                  value: String(w),
                  label:
                    String(w) +
                    (w === 400 ? ' · Regular' : w === 700 ? ' · Bold' : ''),
                }))}
              />
            )}
            {toggle(
              'tabularNums',
              'Equal-width digits',
              'Keep digit spacing consistent as time changes.'
            )}
          </Section>
          <Section title="Clock color">
            <Segments
              label="Color style"
              value={s.clockMode}
              onChange={(v) => update('clockMode', v)}
              options={[
                { value: 'solid', label: 'Solid' },
                { value: 'gradient', label: 'Gradient' },
              ]}
            />
            {s.clockMode === 'solid' ? (
              color('clockColor', 'Digits color')
            ) : (
              <>
                {color('clockGradientStart', 'Start color')}
                {color('clockGradientEnd', 'End color')}
                {number('clockGradientAngle', 'Gradient angle', 0, 360, 1, '°')}
              </>
            )}
            {toggle('showStroke', 'Outline')}
            {s.showStroke && (
              <>
                {color('strokeColor', 'Outline color')}
                {number('strokeWidth', 'Outline width', 0.5, 10, 0.5, 'px')}
              </>
            )}
          </Section>
        </>
      )}
      {section === 'display' && (
        <>
          <Section title="Time">
            <Segments
              label="Time format"
              value={s.clockFormat}
              onChange={(v) => update('clockFormat', v)}
              options={[
                { value: '24h', label: '24 hour' },
                { value: '12h', label: '12 hour' },
              ]}
            />
            {toggle('showSeconds', 'Show seconds')}
            {toggle(
              'pulseColon',
              'Pulse the colon',
              'A soft pulse when seconds are hidden.'
            )}
            {s.clockFormat === '12h' && (
              <Segments
                label="AM / PM position"
                columns={2}
                value={s.ampmPosition}
                onChange={(v) => update('ampmPosition', v)}
                options={[
                  { value: 'before', label: 'Before time' },
                  { value: 'after', label: 'After time' },
                  { value: 'top', label: 'Above time' },
                  { value: 'bottom', label: 'Below time' },
                ]}
              />
            )}
          </Section>
          <Section title="Screen">
            <Segments
              label="Screen rotation"
              columns={2}
              value={s.orientation}
              onChange={(v) => update('orientation', v)}
              options={[
                { value: 'default', label: 'Natural' },
                { value: 'rotate90', label: '90° clockwise' },
                { value: 'rotate180', label: '180° upside down' },
                { value: 'rotate270', label: '90° counterclockwise' },
              ]}
            />
            <Segments
              label="Digit animation"
              columns={2}
              value={s.animationMode}
              onChange={(v) => update('animationMode', v)}
              options={[
                { value: 'none', label: 'None' },
                { value: 'flow', label: 'Number flow' },
                { value: 'shuffle', label: 'Shuffle' },
                { value: 'type', label: 'Typewriter' },
                { value: 'slide-v', label: 'Slide vertically' },
                { value: 'slide-h', label: 'Slide horizontally' },
                { value: 'fade', label: 'Fade' },
                { value: 'zoom', label: 'Zoom' },
                { value: 'flip-v', label: 'Flip vertically' },
                { value: 'flip-h', label: 'Flip horizontally' },
                { value: 'blur', label: 'Blur' },
                { value: 'bounce', label: 'Bounce' },
                { value: 'rotate', label: 'Rotate' },
              ]}
            />
            {toggle(
              'autoHideControls',
              'Auto-hide controls',
              'Fade after 10 seconds. Touch the screen to reveal.'
            )}
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  if (document.fullscreenElement)
                    await document.exitFullscreen();
                  else await document.documentElement.requestFullscreen();
                } catch {
                  toast.error(
                    'Fullscreen is unavailable here. Install the app for a fullscreen clock.'
                  );
                }
              }}
            >
              <Expand size={16} /> Toggle fullscreen
            </Button>
          </Section>
          <Section title="Labels">
            {toggle('showTopText', 'Top label')}
            {s.showTopText && (
              <Input
                aria-label="Top label text"
                placeholder="Make room for what matters"
                value={s.topText}
                maxLength={120}
                onChange={(e) => update('topText', e.target.value)}
              />
            )}
            {toggle('showBottomText', 'Bottom label')}
            {s.showBottomText && (
              <Input
                aria-label="Bottom label text"
                placeholder="One thing at a time"
                value={s.bottomText}
                maxLength={120}
                onChange={(e) => update('bottomText', e.target.value)}
              />
            )}
            <p className="setting-note">
              Timers and AM/PM take priority when they share a label position.
              Automatic fit includes visible labels.
            </p>
          </Section>
          <Section title="Start fresh">
            {resetting ? (
              <div className="reset-confirm">
                <p>Reset appearance and remove configured timers?</p>
                <Button
                  variant="default"
                  onClick={() => {
                    resetToDefaults();
                    setResetting(false);
                    toast.success('Default settings restored');
                  }}
                >
                  Reset settings
                </Button>
                <Button variant="ghost" onClick={() => setResetting(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setResetting(true)}>
                <RotateCcw size={15} /> Reset all settings
              </Button>
            )}
          </Section>
        </>
      )}
      {section === 'position' && (
        <>
          <div className="fit-preview">
            <span className="fit-corner tl" />
            <span className="fit-corner tr" />
            <strong>12:48</strong>
            <span className="fit-corner bl" />
            <span className="fit-corner br" />
          </div>
          <Segments
            label="Position mode"
            value={position}
            onChange={(v) =>
              updateMultiple({
                autoFit: v === 'auto',
                clockFloating: v === 'floating',
              })
            }
            options={[
              { value: 'auto', label: 'Automatic' },
              { value: 'manual', label: 'Manual' },
              { value: 'floating', label: 'Floating' },
            ]}
          />
          {position === 'auto' ? (
            <Section title="Fit to your screen">
              <p className="setting-note">
                The visible edges of your numbers fit the available width and
                height. Recalculates for each font, screen rotation, and display
                option.
              </p>
              {number('edgePadding', 'Space from edges', 0, 120, 1, 'px')}
              <div className="inline-notice">
                <Scan size={18} />
                <p>
                  Only edge spacing is needed. Your manual position and scale
                  stay saved for later.
                </p>
              </div>
            </Section>
          ) : position === 'manual' ? (
            <Section title="Manual adjustment">
              {number('scale', 'Clock scale', 0.1, 4, 0.01, '×')}
              {number('offsetX', 'Horizontal position', -100, 100, 1, '%')}
              {number('offsetY', 'Vertical position', -100, 100, 1, '%')}
              <Button
                variant="outline"
                onClick={() =>
                  updateMultiple({ scale: 1, offsetX: 0, offsetY: 0 })
                }
              >
                Center & reset scale
              </Button>
            </Section>
          ) : (
            <Section title="Move it your way">
              <p className="setting-note">
                Drag the clock. Use two fingers to resize and rotate, or
                fine-tune below.
              </p>
              {number('clockFloatX', 'Horizontal position', 0, 100, 1, '%')}
              {number('clockFloatY', 'Vertical position', 0, 100, 1, '%')}
              {number('clockFloatScale', 'Clock scale', 0.15, 6, 0.05, '×')}
              {number(
                'clockFloatRotation',
                'Clock rotation',
                -180,
                360,
                1,
                '°'
              )}
              <Button
                variant="outline"
                onClick={() =>
                  updateMultiple({
                    clockFloatX: 50,
                    clockFloatY: 50,
                    clockFloatScale: 1,
                    clockFloatRotation: 0,
                  })
                }
              >
                Center & reset
              </Button>
            </Section>
          )}
        </>
      )}
    </Panel>
  );
}
