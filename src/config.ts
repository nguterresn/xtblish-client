export interface xtblishConfig {
  outAppDir: string;
  outImageDir: string;
  user: {
    id: number;
    signKey: string;
    apiKey: string; // Later change to JWT token?
  };
  org: {
    id: number;
  };
}
