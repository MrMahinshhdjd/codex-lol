// Types for our app
export type ModelMode = 'expert' | 'fast';

export interface FileAction {
  type: 'create' | 'delete';
  path: string;
  content?: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  error?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  actions?: FileAction[];
}
