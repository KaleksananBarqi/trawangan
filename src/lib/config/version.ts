import pkg from '../../../package.json';

/**
 * Versi aplikasi Trawangan yang tersinkronisasi secara terpusat dengan package.json.
 */
export const APP_VERSION: string = pkg.version;
export const APP_NAME: string = 'trawangan';
export const APP_RELEASE_TAG: string = `v${pkg.version}`;
