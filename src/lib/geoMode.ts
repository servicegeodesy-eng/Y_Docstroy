const GEO_HOSTNAME = import.meta.env.VITE_GEO_HOSTNAME || "";

export function isGeoMode(): boolean {
  return GEO_HOSTNAME !== "" && window.location.hostname === GEO_HOSTNAME;
}

export function getGeoUrl(): string {
  if (!GEO_HOSTNAME) return "";
  return `https://${GEO_HOSTNAME}`;
}
