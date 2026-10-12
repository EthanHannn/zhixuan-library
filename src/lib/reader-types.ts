export interface ReaderContext {
  user: { id: string; username: string; nickname: string; role: string };
  logoutUrl: string;
}
