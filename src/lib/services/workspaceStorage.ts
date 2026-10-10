// Deprecated Compatibility Facade - Gunakan $lib/services/persistence secara langsung
export type { SavedWorkspace } from '../types/market';
export {
  saveWorkspace,
  loadWorkspaces as getWorkspaces,
  deleteWorkspace,
} from './persistence';
