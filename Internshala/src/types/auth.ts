export type LoginType = "google" | "credentials";

export interface PendingUser {
  uid: string;
  email: string;
  name: string;
  photo: string;
  historyId: string | null;
  loginType?: LoginType;
  identifier?: string;
}

export interface CredentialsUser {
  uid: string;
  name: string;
  email: string;
  photo?: string;
}
