import React from 'react'
import { Toaster } from 'sonner'
import { Clock } from '@/components/Clock'
import { cn } from '@/lib/cn'
import { GearButton } from '@/components/GearButton'
import { SettingsSheet } from '@/components/SettingsSheet'
import { AmoledMesh } from '@/components/AmoledMesh'
import { RefreshButton } from '@/components/RefreshButton'
import { useSettingsStore } from '@/store/settings'
import { DriftOffset, generateRandomDrift, prefersReducedMotion } from '@/lib/amoledSaver'
import { loadGoogleFont, CURATED_FONTS } from '@/lib/fonts'
import { usePWA } from '@/hooks/usePWA';

export function App() {
  const { settings, loadSettings } = useSettingsStore();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [time, setTime] = React.useState({ main: '', ampm: '' });
  const [showControls, setShowControls] = React.useState(true);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
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
  usePWA();

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
      const main = settings.showSeconds ? `${base}:${seconds}` : base;
      return { main, ampm: isPM ? 'PM' : 'AM' };
    } else {
      const hoursStr = hours.toString().padStart(2, '0');
      const base = `${hoursStr}:${minutes}`;
      const main = settings.showSeconds ? `${base}:${seconds}` : base;
      return { main, ampm: '' };
    }
  }, [settings.clockFormat, settings.showSeconds]);

  React.useEffect(() => {
    setTime(formatTime());
    const interval = setInterval(() => {
      setTime(formatTime());
    }, 500);

    timeIntervalRef.current = interval;

    return () => {
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
    };
  }, [formatTime]);

  React.useEffect(() => {
    const fontFamily = settings.customFontFamily || settings.fontFamily;
    const curated = CURATED_FONTS.find((f) => f.value === fontFamily);

    if (curated) {
      loadGoogleFont(fontFamily, curated.weights).catch(() => { });
    } else if (fontFamily) {
      loadGoogleFont(fontFamily, [400, 700, settings.fontWeight]).catch(() => { });
    }
  }, [settings.fontFamily, settings.customFontFamily, settings.fontWeight]);

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

  React.useEffect(() => {
    if (!settings.enableAMOLEDSaver || reducedMotion || isSettingsOpen) {
      if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
      return;
    }

    const driftInterval = setInterval(() => {
      setDriftOffset(generateRandomDrift());
    }, 60000); 

    driftIntervalRef.current = driftInterval;

    return () => {
      if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
    };
  }, [settings.enableAMOLEDSaver, reducedMotion, isSettingsOpen]);

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (driftIntervalRef.current) {
          clearInterval(driftIntervalRef.current);
          driftIntervalRef.current = null;
        }
        if (timeIntervalRef.current) {
          clearInterval(timeIntervalRef.current);
          timeIntervalRef.current = null;
        }
      } else {
        setTime(formatTime());

        if (!timeIntervalRef.current) {
          timeIntervalRef.current = setInterval(() => {
            setTime(formatTime());
          }, 500);
        }

        if (settings.enableAMOLEDSaver && !reducedMotion && !driftIntervalRef.current && !isSettingsOpen) {
          driftIntervalRef.current = setInterval(() => {
            setDriftOffset(generateRandomDrift());
          }, 45000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings.enableAMOLEDSaver, reducedMotion, isSettingsOpen, formatTime]);

  // Handle auto-hiding controls
  React.useEffect(() => {
    if (!settings.autoHideControls) {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      return;
    }

    const resetTimer = () => {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        if (!isSettingsOpen) {
          setShowControls(false);
        }
      }, 10000);
    };

    // Initial timer
    resetTimer();

    const handleActivity = () => {
      resetTimer();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [settings.autoHideControls, isSettingsOpen]);

  const bgStyle: React.CSSProperties = React.useMemo(() => {
    if (settings.enableAMOLEDSaver) {
      return { backgroundColor: '#000000' };
    }

    if (settings.backgroundMode === 'gradient') {
      const angle = 135;
      return {
        background: `linear-gradient(${angle}deg, ${settings.gradientStart}, ${settings.gradientEnd})`,
        transition: reducedMotion ? 'none' : 'background 0.3s ease-in-out',
      };
    }

    if (settings.backgroundMode === 'image') {
      return {
        backgroundImage: `url(${settings.backgroundImage})`,
        backgroundSize: `${settings.bgScale * 100}%`,
        backgroundPosition: `${settings.bgOffsetX}% ${settings.bgOffsetY}%`,
        backgroundRepeat: 'no-repeat',
        transition: reducedMotion ? 'none' : 'opacity 0.3s ease-in-out',
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
    settings.backgroundImage,
    settings.bgScale,
    settings.bgOffsetX,
    settings.bgOffsetY,
    reducedMotion,
  ]);

  return (
    <div 
      className="relative w-full h-screen overflow-hidden"
      style={bgStyle}
    >
      <div
        className="w-full h-full select-none pointer-events-none"
        style={{
          ...getRotationStyle(),
          transformOrigin: 'center center',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
        {time.main && (
          <Clock
            time={time.main}
            ampm={time.ampm}
            ampmPosition={settings.ampmPosition}
            color={settings.clockColor}
            fontFamily={settings.customFontFamily || settings.fontFamily}
            scale={settings.scale}
            offsetX={settings.offsetX}
            offsetY={settings.offsetY}
            driftOffset={settings.enableAMOLEDSaver && settings.amoledSaverMode === 'drift' ? driftOffset : { x: 0, y: 0 }}
            prefersReducedMotion={reducedMotion}
            fontWeight={settings.fontWeight}
            refreshKey={refreshKey}
            animationMode={settings.animationMode}
            topText={settings.topText}
            bottomText={settings.bottomText}
            showTopText={settings.showTopText}
            showBottomText={settings.showBottomText}
          />
        )}
      </div>

      <div
        className={cn(
          "transition-opacity duration-1000 mix-blend-difference pb-safe",
          !showControls ? "opacity-0" : "opacity-100"
        )}
      >
        <RefreshButton
          onRefresh={() => setRefreshKey(prev => prev + 1)}
          prefersReducedMotion={reducedMotion}
        />

        <GearButton
          isOpen={isSettingsOpen}
          onToggle={() => setIsSettingsOpen(!isSettingsOpen)}
          prefersReducedMotion={reducedMotion}
        />
      </div>

      {settings.enableAMOLEDSaver && settings.amoledSaverMode === 'mesh' && (
        <AmoledMesh
          type={settings.amoledMeshType}
          driftOffset={driftOffset}
          prefersReducedMotion={reducedMotion}
        />
      )}

      <SettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <Toaster position="bottom-center" />
    </div>
  );
}
