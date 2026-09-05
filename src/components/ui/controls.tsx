import React from 'react';
import { Dialog, Slider, Switch, ToggleGroup } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva('ui-button', {
  variants: {
    variant: {
      default: 'ui-button-primary',
      secondary: 'ui-button-secondary',
      ghost: 'ui-button-ghost',
      outline: 'ui-button-outline',
    },
    size: { default: '', icon: 'ui-button-icon', small: 'ui-button-small' },
  },
  defaultVariants: { variant: 'secondary', size: 'default' },
});
export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>) {
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('ui-input', className)} {...props} />;
}
export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="setting-row">
      <label htmlFor={id}>
        <span>{label}</span>
        {description && <small>{description}</small>}
      </label>
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="ui-switch"
      >
        <Switch.Thumb className="ui-switch-thumb" />
      </Switch.Root>
    </div>
  );
}
export function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="setting-range">
      <div>
        <span>{label}</span>
        <output>
          {Number(value.toFixed(2))}
          {unit}
        </output>
      </div>
      <Slider.Root
        aria-label={label}
        className="ui-slider"
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0])}
      >
        <Slider.Track className="ui-slider-track">
          <Slider.Range className="ui-slider-range" />
        </Slider.Track>
        <Slider.Thumb className="ui-slider-thumb" aria-label={label} />
      </Slider.Root>
    </div>
  );
}
export function Segments<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="setting-field">
      <span className="field-label">{label}</span>
      <ToggleGroup.Root
        type="single"
        aria-label={label}
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as T);
        }}
        className="ui-segments"
      >
        {options.map((o) => (
          <ToggleGroup.Item
            key={o.value}
            value={o.value}
            className="ui-segment"
          >
            {o.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="setting-field">
      <span className="field-label">{label}</span>
      <select
        className="ui-input"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  return (
    <label className="color-field">
      <span>{label}</span>
      <div>
        <input
          type="color"
          aria-label={label}
          value={/^#[\da-f]{6}$/i.test(value) ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input
          aria-label={label + ' hex'}
          value={draft}
          maxLength={7}
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#[\da-f]{6}$/i.test(e.target.value)) onChange(e.target.value);
          }}
          onBlur={() => setDraft(value)}
        />
      </div>
    </label>
  );
}
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="setting-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
export function Panel({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const body = React.useRef<HTMLDivElement>(null);
  const returnFocus = React.useRef<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [title, open]);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      modal={false}
    >
      <Dialog.Portal>
        <Dialog.Content
          className="settings-panel"
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus.current?.isConnected) returnFocus.current.focus();
          }}
          onInteractOutside={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest('.settings-rail')) {
              returnFocus.current = target.closest('button');
              event.preventDefault();
            }
          }}
        >
          <header className="panel-header">
            <div>
              <span className="eyebrow">MAKE TIME YOURS</span>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close settings">
                <X size={19} />
              </Button>
            </Dialog.Close>
          </header>
          <div className="panel-body" ref={body}>
            {children}
          </div>
          {footer && <footer className="panel-footer">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
