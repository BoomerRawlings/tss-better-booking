import { PACKAGES, TRUSTED_ROUTES } from './generated/config.mjs';
export const BOOKING_ROUTES = new Map(PACKAGES.map(({ route, ...item }) => [route, Object.freeze(item)]));
export const DEFAULT_ROUTE = BOOKING_ROUTES.keys().next().value;
// Configuration must record independent read-only proof for each exact route.
export const VERIFIED_STANDARD_ROUTES = new Set(TRUSTED_ROUTES);
