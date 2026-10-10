// Deprecated Compatibility Facade - Gunakan $lib/services/persistence secara langsung
export type { SavedWorkspace } from '../types/market';
export {
  saveWorkspace,
  updateWorkspace,
  loadWorkspaces as getWorkspaces,
  deleteWorkspace,
} from './persistence';
