export interface SavedWorkspace {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  layout: string;
  indicators: { title: string; source?: string; visible: boolean }[];
  timestamp: number;
}

export function saveWorkspace(workspace: Omit<SavedWorkspace, 'id' | 'timestamp'>): void {
  try {
    const data = localStorage.getItem('trawangan_workspaces');
    let workspaces: SavedWorkspace[] = data ? JSON.parse(data) : [];
    
    // Generate simple ID
    const newWorkspace: SavedWorkspace = {
      ...workspace,
      id: Date.now().toString(),
      timestamp: Date.now()
    };
    
    workspaces.push(newWorkspace);
    localStorage.setItem('trawangan_workspaces', JSON.stringify(workspaces));
  } catch (err) {
    console.error('Failed to save workspace:', err);
  }
}

export function getWorkspaces(): SavedWorkspace[] {
  try {
    const data = localStorage.getItem('trawangan_workspaces');
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Failed to get workspaces:', err);
    return [];
  }
}

export function deleteWorkspace(id: string): void {
  try {
    const data = localStorage.getItem('trawangan_workspaces');
    let workspaces: SavedWorkspace[] = data ? JSON.parse(data) : [];
    workspaces = workspaces.filter(w => w.id !== id);
    localStorage.setItem('trawangan_workspaces', JSON.stringify(workspaces));
  } catch (err) {
    console.error('Failed to delete workspace:', err);
  }
}
