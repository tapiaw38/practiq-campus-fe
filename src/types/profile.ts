export interface Profile {
  id: string;
  profile_type: "student" | "teacher";
  full_name: string;
  email: string;
  avatar_url: string;
  bio: string;
  is_blocked: boolean;
  created_at: string;
}

export interface PractiqStudent {
  id: string;
  name: string;
  email: string;
}

export interface CreateOrSyncUserParams {
  email: string;
  first_name?: string;
  last_name?: string;
  password?: string;
}
