import React from 'react'
import { Toaster } from 'sonner'
import { Clock } from '@/components/Clock'
import { GearButton } from '@/components/GearButton'
import { SettingsSheet } from '@/components/SettingsSheet'
import { useSettingsStore } from '@/store/settings'
import { DriftOffset, generateRandomDrift, prefersReducedMotion } from '@/lib/amoledSaver'
import { loadGoogleFont, CURATED_FONTS } from '@/lib/fonts'
import { usePWA } from '@/hooks/usePWA';

export function App() {
  const { settings, loadSettings } = useSettingsStore();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [time, setTime] = React.useState('');
  const [driftOffset, setDriftOffset] = React.useState<DriftOffset>({
    x: 0,
    y: 0,
  });
  const driftIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const timeIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const reducedMotion = prefersReducedMotion();
  usePWA(); // Initialize PWA functionality

  // Load settings from localStorage on mount
  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Format time based on settings
  const formatTime = React.useCallback(() => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    if (settings.clockFormat === '12h') {
      const isPM = hours >= 12;
      hours = hours % 12 || 12;
      const hoursStr = hours.toString().padStart(2, '0');
      const base = `${hoursStr}:${minutes}`;
      const result = settings.showSeconds ? `${base}:${seconds}` : base;
      return `${result} ${isPM ? 'PM' : 'AM'}`;
    } else {
      const hoursStr = hours.toString().padStart(2, '0');
      const base = `${hoursStr}:${minutes}`;
      return settings.showSeconds ? `${base}:${seconds}` : base;
    }
  }, [settings.clockFormat, settings.showSeconds]);

  // Update time
  React.useEffect(() => {
    setTime(formatTime());

    const interval = setInterval(
      () => {
        setTime(formatTime());
      },
      settings.showSeconds ? 1000 : 60000
    );

    timeIntervalRef.current = interval;

    return () => {
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
    };
  }, [formatTime, settings.showSeconds]);

  // Load font on settings change
  React.useEffect(() => {
    const fontFamily = settings.customFontFamily || settings.fontFamily;
    const curated = CURATED_FONTS.find((f) => f.value === fontFamily);

    if (curated) {
      loadGoogleFont(fontFamily, curated.weights).catch(() => {
        // Silently fail; component will use fallback
      });
    }
  }, [settings.fontFamily, settings.customFontFamily]);

  // Apply orientation rotation via CSS transform
  const getRotationStyle = (): React.CSSProperties => {
    const rotationMap: Record<string, number> = {
      default: 0,
      rotate90: 90,
      rotate180: 180,
      rotate270: 270,
    };
    const angle = rotationMap[settings.orientation] || 0;
    return angle === 0 ? {} : { transform: `rotate(${angle}deg)` };
  };

  // AMOLED drift logic
  React.useEffect(() => {
    if (!settings.enableAMOLEDSaver || reducedMotion || isSettingsOpen) {
      // Clear drift interval if AMOLED saver is disabled
      if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
      return;
    }

    const driftInterval = setInterval(() => {
      setDriftOffset(generateRandomDrift());
    }, 45000); // Every 45 seconds

    driftIntervalRef.current = driftInterval;

    return () => {
      if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
    };
  }, [settings.enableAMOLEDSaver, reducedMotion, isSettingsOpen]);

  // Handle visibility change: pause drift when window is not visible
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && driftIntervalRef.current) {
        clearInterval(driftIntervalRef.current);
        driftIntervalRef.current = null;
      } else if (
        !document.hidden &&
        settings.enableAMOLEDSaver &&
        !reducedMotion
      ) {
        // Resume drift
        const driftInterval = setInterval(() => {
          setDriftOffset(generateRandomDrift());
        }, 45000);
        driftIntervalRef.current = driftInterval;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings.enableAMOLEDSaver, reducedMotion]);

  // Compute background style
  const bgStyle: React.CSSProperties = React.useMemo(() => {
    if (settings.enableAMOLEDSaver || settings.backgroundMode === 'amoled') {
      return { backgroundColor: '#000000' };
    }

    if (settings.backgroundMode === 'gradient') {
      const angle = 135;
      return {
        background: `linear-gradient(${angle}deg, ${settings.gradientStart}, ${settings.gradientEnd})`,
        transition: reducedMotion ? 'none' : 'background 0.3s ease-in-out',
      };
    }

    return {
      backgroundColor: settings.solidColor,
      transition: reducedMotion ? 'none' : 'background-color 0.3s ease-in-out',
    };
  }, [
    settings.enableAMOLEDSaver,
    settings.backgroundMode,
    settings.gradientStart,
    settings.gradientEnd,
    settings.solidColor,
    reducedMotion,
  ]);

  return (
    <div className="relative w-full h-screen overflow-hidden" style={bgStyle}>
      {/* Rotation wrapper for orientation */}
      <div
        className="w-full h-full"
        style={{
          ...getRotationStyle(),
          transformOrigin: 'center center',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {/* Clock Display */}
        {time && (
          <Clock
            time={time}
            color={settings.clockColor}
            fontFamily={settings.customFontFamily || settings.fontFamily}
            paddingX={settings.paddingX}
            paddingY={settings.paddingY}
            driftOffset={driftOffset}
            prefersReducedMotion={reducedMotion}
          />
        )}

        {/* Settings Gear Button */}
        <GearButton
          isOpen={isSettingsOpen}
          onToggle={() => setIsSettingsOpen(!isSettingsOpen)}
          prefersReducedMotion={reducedMotion}
        />

        {/* Settings Sheet */}
        <SettingsSheet
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>

      {/* Toast Container */}
      <Toaster position="bottom-center" />
    </div>
  );
}
