export interface AggregatedChatEvents {
  model?: string;
  text: string;
  citations: unknown[];
  errors: string[];
  done: boolean;
  usage?: unknown;
}

export interface LiveSampleResultInput {
  id: string;
  status: number;
  contentType: string | null;
  events: readonly unknown[];
  aggregate: AggregatedChatEvents;
}

export interface LiveSampleResult {
  id: string;
  passed: boolean;
  status: number;
  contentType: string | null;
  model?: string;
  answerText: string;
  citationCount: number;
  citations: unknown[];
  usage?: unknown;
  errors: string[];
  eventCount: number;
}

export function parseSseEvents(body: string): unknown[];
export function aggregateChatEvents(events: readonly unknown[]): AggregatedChatEvents;
export function buildLiveSampleResult(params: LiveSampleResultInput): LiveSampleResult;
