export interface xtblishConfig {
  outAppDir: string;
  outImageDir: string;
  user: {
    id: number;
    apiKey: string;
  };
  org: {
    id: number;
    signKey: string;
  };
}
