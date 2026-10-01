const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440587.5;
const J2000 = 2451545;

export interface SunTimes {
  /** Minutes after local midnight, or null when the sun doesn't rise/set today. */
  sunrise: number | null;
  sunset: number | null;
  /** Set when the sun stays up (or down) all day — polar summer or winter. */
  polar: 'day' | 'night' | null;
}

const toJulian = (ms: number) => ms / DAY_MS + J1970;
const fromJulian = (j: number) => (j - J1970) * DAY_MS;

/**
 * Sunrise and sunset for the local calendar day of `date`, using the standard
 * sunrise equation (accurate to a minute or two, which is plenty for dimming
 * a screen). Longitude is east-positive.
 */
export function getSunTimes(date: Date, lat: number, lon: number): SunTimes {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  const noon = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);

  const n = Math.round(toJulian(noon) - J2000 + 0.0008);
  const meanSolarTime = n - lon / 360;
  const m = (357.5291 + 0.98560028 * meanSolarTime) % 360;
  const center =
    1.9148 * Math.sin(m * RAD) +
    0.02 * Math.sin(2 * m * RAD) +
    0.0003 * Math.sin(3 * m * RAD);
  const eclipticLon = (m + center + 180 + 102.9372) % 360;
  const transit =
    J2000 +
    meanSolarTime +
    0.0053 * Math.sin(m * RAD) -
    0.0069 * Math.sin(2 * eclipticLon * RAD);
  const declination = Math.asin(
    Math.sin(eclipticLon * RAD) * Math.sin(23.4397 * RAD)
  );
  const cosHourAngle =
    (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(declination)) /
    (Math.cos(lat * RAD) * Math.cos(declination));

  if (cosHourAngle < -1) return { sunrise: null, sunset: null, polar: 'day' };
  if (cosHourAngle > 1) return { sunrise: null, sunset: null, polar: 'night' };

  const hourAngle = Math.acos(cosHourAngle) / RAD;
  const toLocalMinutes = (j: number) => {
    const minutes = (fromJulian(j) - midnight.getTime()) / 60_000;
    return ((minutes % 1440) + 1440) % 1440;
  };
  return {
    sunrise: toLocalMinutes(transit - hourAngle / 360),
    sunset: toLocalMinutes(transit + hourAngle / 360),
    polar: null,
  };
}
