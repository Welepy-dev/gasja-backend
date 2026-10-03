export interface Coordenadas {
  lat: number;
  lng: number;
}

const RAIO_TERRA_KM = 6371;

/** Distância em linha recta (haversine), em km, arredondada a 0,1 km. */
export function distanciaKm(a: Coordenadas, b: Coordenadas): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const km = 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h));
  return Math.round(km * 10) / 10;
}
