import type { ProxyVerifyResult, ScraperStats } from '@repo/shared';

export enum ProxyScheme {
  HTTP = 'http',
  HTTPS = 'https',
  SOCKS5 = 'socks5',
  SOCKS5H = 'socks5h',
}

export type ProxyRowField = 'host' | 'port' | 'username' | 'password';

export interface ProxyRowState {
  /** Local-only React key — never sent anywhere, never a proxy value. */
  localId: string;
  scheme: ProxyScheme;
  host: string;
  port: string;
  username: string;
  password: string;
}

export enum ProxyRowTestState {
  IDLE = 'idle',
  TESTING = 'testing',
  OK = 'ok',
  FAILED = 'failed',
}

export interface ProxyRowTestStatus {
  state: ProxyRowTestState;
  errorKind?: string | null;
}

export interface ScraperProxiesEditorProps {
  /** The setting row's current draft/value — `''` for an unsaved secret. */
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

export interface ScraperProxiesEditorComponentProps {
  rows: ProxyRowState[];
  rowStatuses: Record<string, ProxyRowTestStatus>;
  disabled: boolean;
  canTestRow: (localId: string) => boolean;
  savedResults: ProxyVerifyResult[] | null;
  isSavedTestRunning: boolean;
  savedTestFailed: boolean;
  /** Real traffic per proxy over the last hour (host:port ids only). */
  proxyStats: ScraperStats['proxies'];
  onFieldChange: (localId: string, field: ProxyRowField, value: string) => void;
  onSchemeChange: (localId: string, scheme: string | number) => void;
  onAddRow: () => void;
  onRemoveRow: (localId: string) => void;
  onTestRow: (localId: string) => void;
  onTestSaved: () => void;
}
