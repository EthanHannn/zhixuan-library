import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    username: string;
    nickname: string;
    role: string;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      nickname: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username: string;
    nickname: string;
    role: string;
  }
}
