export interface xtblishConfig {
  outDir: string;
  user: {
    id: number;
    signKey: string;
  };
  org: {
    id: number;
    provisionJWTToken: string;
  };
}
