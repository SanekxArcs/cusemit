import React from 'react';
import { Accordion, ToggleGroup } from 'radix-ui';
import { Check, ChevronDown, Plus } from 'lucide-react';
import colors from 'tailwindcss/colors';
import { useSettingsStore } from '@/store/settings';
import { Button, Input } from './ui/controls';

const families = Object.entries(colors).filter(
  (entry): entry is [string, typeof colors.red] => typeof entry[1] === 'object'
);
const presets = [
  { name: 'Black', value: '#000000' },
  { name: 'White', value: '#ffffff' },
  ...families.flatMap(([family, shades]) => Object.entries(shades).map(([shade, value]) => ({
    name: `${family[0].toUpperCase() + family.slice(1)} ${shade}`, value,
  }))),
];
const isHex = (value: string) => /^#[\da-f]{6}$/i.test(value);

export function ColorPicker({ value, onChange, label = 'Color' }: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}) {
  const customColors = useSettingsStore((s) => s.settings.customColors);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState('#ffffff');
  const errorId = React.useId();
  const selected = value.toLowerCase();
  const currentName = presets.find((p) => p.value === selected)?.name ?? value.toUpperCase();

  const swatch = (color: string, name: string, caption: string) => (
    <ToggleGroup.Item key={name} value={color} aria-label={name} title={name} className="palette-swatch">
      <span className="palette-chip" style={{ backgroundColor: color }}>
        {selected === color && <Check size={12} className="palette-check" />}
      </span>
      <span className="palette-caption">{caption}</span>
    </ToggleGroup.Item>
  );

  function saveCustom() {
    if (!isHex(draft)) return;
    const color = draft.toLowerCase();
    // Separate color controls share the latest saved palette.
    const saved = useSettingsStore.getState().settings.customColors;
    if (!saved.includes(color) && !presets.some((p) => p.value === color)) {
      updateSetting('customColors', [...saved, color]);
    }
    onChange(color);
    setAdding(false);
  }

  return (
    <Accordion.Root type="single" collapsible className="color-accordion">
      <Accordion.Item value="palette">
        <Accordion.Header>
          <Accordion.Trigger className="color-trigger" aria-label={label}>
            <span className="color-current" style={{ backgroundColor: value }} />
            <span className="color-trigger-label"><span>{label}</span><small>{currentName}</small></span>
            <ChevronDown size={15} className="color-chevron" />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="color-content">
          <ToggleGroup.Root type="single" aria-label={`${label} swatches`} value={selected}
            onValueChange={(color) => { if (color) onChange(color); }} className="palette-options">
            <div className="palette-scroll">
              <p className="palette-heading">Essentials</p>
              <div className="palette-grid">
                {swatch('#000000', 'Black', 'Black')}
                {swatch('#ffffff', 'White', 'White')}
              </div>
              {families.map(([family, shades]) => (
                <div key={family} className="palette-family">
                  <p className="palette-heading">{family}</p>
                  <div className="palette-grid">
                    {Object.entries(shades).map(([shade, color]) => swatch(
                      color, `${family[0].toUpperCase() + family.slice(1)} ${shade}`, shade
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="palette-custom">
              <p className="palette-heading">Your colors <span>Saved on this device</span></p>
              {customColors.length > 0 && (
                <div className="palette-grid palette-saved">
                  {customColors.map((color) => swatch(color, `Custom ${color}`, color.slice(1).toUpperCase()))}
                </div>
              )}
            </div>
          </ToggleGroup.Root>
          {adding ? (
            <form className="palette-editor" onSubmit={(event) => { event.preventDefault(); saveCustom(); }}>
              <label className="field-label" htmlFor={`${errorId}-hex`}>Custom color</label>
              <div className="palette-editor-inputs">
                <input type="color" aria-label={`${label} custom color`} value={isHex(draft) ? draft : '#ffffff'} onChange={(e) => setDraft(e.target.value)} />
                <Input id={`${errorId}-hex`} aria-label={`${label} custom hex`} autoFocus value={draft}
                  maxLength={7} spellCheck={false} autoComplete="off" aria-invalid={!isHex(draft)}
                  aria-describedby={!isHex(draft) ? errorId : undefined} onChange={(e) => setDraft(e.target.value)} />
              </div>
              {!isHex(draft) && <p id={errorId} className="palette-error">Use six hex digits, for example #A3E635.</p>}
              <div className="palette-editor-actions">
                <Button type="submit" variant="default" disabled={!isHex(draft)}>Save & apply</Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <div className="palette-editor-actions">
              <Button variant="outline" onClick={() => { setDraft(isHex(value) ? value : '#ffffff'); setAdding(true); }}>
                <Plus size={15} /> Add custom color
              </Button>
              {customColors.includes(selected) && <Button variant="ghost" size="small"
                onClick={() => updateSetting('customColors', customColors.filter((c) => c !== selected))}>Remove saved color</Button>}
            </div>
          )}
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
