export interface Template {
  id: string;
  title: string;
  content: string;
  modified: number;
  pinned: boolean;
  locked: boolean;
  pinPosition?: number;
}

export interface ShelfItem {
  id: string;
  title: string;
  content: string;
  modified: number;
}

export interface SpellingError {
  word: string;
  replacements: string[];
  reason: string;
  // Index coordinates dynamically calculated on the text block
  index?: number;
}

export interface UserAccount {
  username: string;
  createdAt: string;
}
