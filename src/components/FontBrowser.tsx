import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Check,
  Trash2,
  LoaderCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CURATED_FONTS,
  getFontFamilyCSS,
  isFontAvailableOffline,
  loadGoogleFont,
  normalizeFont,
  saveGoogleFont,
} from '@/lib/fonts';
import { useSettingsStore } from '@/store/settings';
import { Button, Input } from './ui/controls';

export function FontBrowser() {
  const {
    settings,
    updateMultiple,
    addSavedFont,
    removeSavedFont,
    hideCuratedFont,
    resetHiddenFonts,
  } = useSettingsStore();
  const active = normalizeFont(
    settings.customFontFamily || settings.fontFamily
  );
  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [offline, setOffline] = React.useState(false);
  const [filter, setFilter] = React.useState<'all' | 'saved'>('all');
  const request = React.useRef(0);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current++;
    };
  }, []);
  const fonts = React.useMemo(
    () => [
      ...new Set([
        ...CURATED_FONTS.filter(
          (f) => !settings.hiddenCuratedFonts.includes(f.value)
        ).map((f) => f.label),
        ...settings.savedFonts.map(normalizeFont),
        active,
      ]),
    ],
    [settings.hiddenCuratedFonts, settings.savedFonts, active]
  );
  React.useEffect(() => {
    let alive = true;
    setOffline(false);
    isFontAvailableOffline(active).then((available) => {
      if (alive) setOffline(available);
    });
    return () => {
      alive = false;
    };
  }, [active, busy]);
  async function choose(name: string, save = false) {
    const version = ++request.current;
    setBusy(name);
    const curated = CURATED_FONTS.find((f) => f.label === name);
    const weights = curated?.weights ?? [400, 700, settings.fontWeight];
    const weight = weights.includes(settings.fontWeight)
      ? settings.fontWeight
      : weights.includes(700)
        ? 700
        : weights[0];
    try {
      if (save) await saveGoogleFont(name, weights);
      else await loadGoogleFont(name, weights);
      if (!mounted.current || version !== request.current) return;
      updateMultiple({
        fontFamily: curated?.value ?? name,
        customFontFamily: curated ? '' : name,
        fontWeight: weight,
      });
      if (save) {
        addSavedFont(name);
        toast.success(name + ' saved for offline use');
        setAdding(false);
        setQuery('');
      }
    } catch (error) {
      if (mounted.current && version === request.current)
        toast.error(
          error instanceof Error ? error.message : 'Could not load font'
        );
    } finally {
      if (mounted.current && version === request.current) setBusy('');
    }
  }
  const saved = settings.savedFonts.some((f) => normalizeFont(f) === active);
  const shown =
    filter === 'saved'
      ? fonts.filter((f) =>
          settings.savedFonts.some((s) => normalizeFont(s) === f)
        )
      : fonts;
  const cycle = shown.length ? shown : [active];
  const index = cycle.indexOf(active);
  return (
    <div className="font-browser">
      <div className="font-preview">
        <span className="eyebrow">LIVE ON YOUR CLOCK</span>
        <div className="font-carousel">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous font"
            onClick={() =>
              choose(cycle[(index - 1 + cycle.length) % cycle.length])
            }
          >
            <ChevronLeft />
          </Button>
          <div>
            <strong
              style={{
                fontFamily: getFontFamilyCSS(active),
                fontWeight: settings.fontWeight,
              }}
            >
              12:48
            </strong>
            <span>{active}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next font"
            onClick={() => choose(cycle[(index + 1) % cycle.length])}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="font-status">
          {busy ? (
            <>
              <LoaderCircle size={13} className="spin" /> Loading {busy}…
            </>
          ) : offline ? (
            <>
              <Check size={13} /> Available offline on this device
            </>
          ) : (
            'Preview a font, then save it for offline use'
          )}
        </div>
      </div>
      <div className="font-actions">
        <Button
          size="small"
          onClick={() => choose(active, true)}
          disabled={!!busy || (saved && offline)}
        >
          {saved && offline ? <Check size={15} /> : <Download size={15} />}{' '}
          {saved && offline ? 'Saved' : 'Save offline'}
        </Button>
        <Button
          size="small"
          variant="outline"
          onClick={() => setAdding(!adding)}
          aria-expanded={adding}
        >
          <Plus size={15} /> Add font
        </Button>
      </div>
      {adding && (
        <form
          className="add-font"
          onSubmit={(e) => {
            e.preventDefault();
            choose(normalizeFont(query), true);
          }}
        >
          <label htmlFor="google-family">Google Fonts family name</label>
          <Input
            id="google-family"
            placeholder="e.g. Doto or Space Grotesk"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
            autoFocus
          />
          <p>
            Enter the family name from{' '}
            <a href="https://fonts.google.com" target="_blank" rel="noreferrer">
              Google Fonts
            </a>
            . Adding downloads it for offline use.
          </p>
          <Button
            type="submit"
            variant="default"
            disabled={!query.trim() || !!busy}
          >
            {busy ? 'Downloading…' : 'Add & save font'}
          </Button>
        </form>
      )}
      <div className="font-library-heading">
        <span>Your font collection</span>
        <div>
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="small"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'saved' ? 'secondary' : 'ghost'}
            size="small"
            onClick={() => setFilter('saved')}
          >
            Saved
          </Button>
        </div>
      </div>
      <div className="font-library">
        {shown.length ? (
          shown.map((name) => (
            <div
              key={name}
              className={'font-option ' + (name === active ? 'selected' : '')}
            >
              <Button
                variant="ghost"
                onClick={() => choose(name)}
                aria-pressed={name === active}
              >
                <span>{name}</span>
                {name === active && <Check size={15} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={'Remove ' + name + ' from collection'}
                onClick={() => {
                  settings.savedFonts
                    .filter((f) => normalizeFont(f) === name)
                    .forEach(removeSavedFont);
                  const curated = CURATED_FONTS.find((f) => f.label === name);
                  if (curated) hideCuratedFont(curated.value);
                }}
              >
                <Trash2 size={13} />
              </Button>
            </div>
          ))
        ) : (
          <p className="setting-note">
            No saved fonts yet. Save the current font or add a new one.
          </p>
        )}
      </div>
      {settings.hiddenCuratedFonts.length > 0 && (
        <Button variant="ghost" size="small" onClick={resetHiddenFonts}>
          Restore hidden fonts
        </Button>
      )}
    </div>
  );
}
