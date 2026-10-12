// Layanan Kamus Glosarium & Registry Keyboard Shortcuts Terminal Trawangan
// Menyediakan daftar lengkap pintasan keyboard, pencarian interaktif, dan kategorisasi.
// Didukung oleh deep module CommandDispatcher sebagai Single Source of Truth.

import {
  commandDispatcher,
  type CommandDefinition,
  type CommandCategory
} from './commandDispatcher';

export type ShortcutItem = CommandDefinition;

/**
 * Glosarium lengkap pintasan keyboard terminal Trawangan.
 * Terikat langsung ke commandDispatcher.
 */
export const SHORTCUT_GLOSSARY: ShortcutItem[] = commandDispatcher.getCommands();

/**
 * Filter shortcut berdasarkan query pencarian (mencocokkan keys, deskripsi, atau kategori).
 */
export function filterShortcuts(query: string): ShortcutItem[] {
  return commandDispatcher.filterCommands(query);
}

/**
 * Mengelompokkan item shortcut berdasarkan nama kategori.
 */
export function getShortcutsByCategory(): Record<string, ShortcutItem[]> {
  return commandDispatcher.getCommandsByCategory();
}
