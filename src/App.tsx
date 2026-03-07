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
import { InfoButton } from '@/components/InfoButton';
import { InfoDialog } from '@/components/InfoDialog';
import { useTimer, formatMs } from '@/hooks/useTimer';
import { TimerWidget } from '@/components/TimerWidget';

export function App() {
  const { settings, loadSettings, updateMultiple } = useSettingsStore();
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [time, setTime] = React.useState({ main: '', ampm: '' });
  const [showControls, setShowControls] = React.useState(true);
  const [isInfoOpen, setIsInfoOpen] = React.useState(false);
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

  // ── Timer ────────────────────────────────────────────────────────────────────
  const timerInitialMs = React.useMemo(() => {
    if (settings.timerInputMode === 'datetime' && settings.timerTargetDatetime) {
      const ms = new Date(settings.timerTargetDatetime).getTime() - Date.now();
      return Math.max(0, ms);
    }
    return (settings.timerHours * 3600 + settings.timerMinutes * 60) * 1000;
  }, [
    settings.timerInputMode,
    settings.timerTargetDatetime,
    settings.timerHours,
    settings.timerMinutes,
  ]);

  const timer = useTimer(timerInitialMs);
  // ─────────────────────────────────────────────────────────────────────────────

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
  }, [settings.enableAMOLEDSaver, reducedMotion, isSettingsOpen, isInfoOpen, formatTime]);

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
        if (!isSettingsOpen && !isInfoOpen) {
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
  }, [settings.autoHideControls, isSettingsOpen, isInfoOpen]);

  const bgStyle: React.CSSProperties = React.useMemo(() => {
    if (settings.enableAMOLEDSaver) {
      return { backgroundColor: '#000000' };
    }

    if (settings.backgroundMode === 'gradient') {
      return {
        background: `linear-gradient(${settings.bgGradientAngle}deg, ${settings.gradientStart}, ${settings.gradientEnd})`,
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
    settings.bgGradientAngle,
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
            clockMode={settings.clockMode}
            color={settings.clockColor}
            gradientStart={settings.clockGradientStart}
            gradientEnd={settings.clockGradientEnd}
            gradientAngle={settings.clockGradientAngle}
            showStroke={settings.showStroke}
            strokeWidth={settings.strokeWidth}
            strokeColor={settings.strokeColor}
            fontFamily={settings.customFontFamily || settings.fontFamily}
            scale={settings.scale}
            offsetX={settings.offsetX}
            offsetY={settings.offsetY}
            driftOffset={settings.enableAMOLEDSaver && settings.amoledSaverMode === 'drift' ? driftOffset : { x: 0, y: 0 }}
            prefersReducedMotion={reducedMotion}
            fontWeight={settings.fontWeight}
            refreshKey={refreshKey}
            animationMode={settings.animationMode}
            topText={
              settings.timerEnabled && settings.timerDisplayPosition === 'top'
                ? formatMs(timer.remainingMs)
                : settings.topText
            }
            bottomText={
              settings.timerEnabled && settings.timerDisplayPosition === 'bottom'
                ? formatMs(timer.remainingMs)
                : settings.bottomText
            }
            showTopText={
              settings.timerEnabled && settings.timerDisplayPosition === 'top'
                ? true
                : settings.showTopText
            }
            showBottomText={
              settings.timerEnabled && settings.timerDisplayPosition === 'bottom'
                ? true
                : settings.showBottomText
            }
            showSeconds={settings.showSeconds}
            pulseColon={settings.pulseColon}
            tabularNums={settings.tabularNums}
            tabularNumsFallback={settings.tabularNumsFallback}
          />
        )}
      </div>

      {/* Timer inline controls (top/bottom mode) shown when timer is enabled and not floating */}
      {settings.timerEnabled && settings.timerDisplayPosition !== 'floating' && (
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 z-40 pointer-events-auto',
            settings.timerDisplayPosition === 'top' ? 'top-2' : 'bottom-8',
          )}
        >
          <TimerWidget
            remainingMs={timer.remainingMs}
            isRunning={timer.isRunning}
            isExpired={timer.isExpired}
            position={settings.timerDisplayPosition}
            floatX={settings.timerFloatX}
            floatY={settings.timerFloatY}
            floatScale={settings.timerFloatScale}
            floatRotation={settings.timerFloatRotation}
            onPlay={timer.play}
            onPause={timer.pause}
            onReset={timer.reset}
            color={settings.clockColor}
          />
        </div>
      )}

      {/* Floating timer (beta) */}
      {settings.timerEnabled && settings.timerDisplayPosition === 'floating' && (
        <TimerWidget
          remainingMs={timer.remainingMs}
          isRunning={timer.isRunning}
          isExpired={timer.isExpired}
          position="floating"
          floatX={settings.timerFloatX}
          floatY={settings.timerFloatY}
          floatScale={settings.timerFloatScale}
          floatRotation={settings.timerFloatRotation}
          onPlay={timer.play}
          onPause={timer.pause}
          onReset={timer.reset}
          onTransformChange={(x, y, scale, rotation) =>
            updateMultiple({
              timerFloatX: x,
              timerFloatY: y,
              timerFloatScale: scale,
              timerFloatRotation: rotation,
            })
          }
          color={settings.clockColor}
        />
      )}

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

        <InfoButton
          onOpen={() => setIsInfoOpen(true)}
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

      <InfoDialog
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />

      <Toaster position="bottom-center" />
    </div>
  );
}
