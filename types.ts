
export interface MatchResult {
  customerName: string;
  rplName: string;
  similarity: number;
}

export interface RawDataRow {
  [key: string]: any;
}

export enum AppState {
  IDLE = 'IDLE',
  MAPPING = 'MAPPING',
  PROCESSING = 'PROCESSING',
  RESULTS = 'RESULTS'
}
