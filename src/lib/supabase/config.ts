export type SupabasePublicConfig = Readonly<{
  url: string;
  anonKey: string;
}>;

function requiredEnvironmentVariable(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  return {
    url: requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requiredEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}
