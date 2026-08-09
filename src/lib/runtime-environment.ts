import { z } from "zod";

const requiredString = z.string().trim().min(1);

const runtimeEnvironmentSchema = z
  .object({
    DATABASE_URL: requiredString,
    NEXTAUTH_URL: z.string().trim().url(),
    NEXTAUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: z.string().trim().optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
    UPLOADTHING_TOKEN: requiredString,
  })
  .superRefine((environment, context) => {
    const hasGoogleId = Boolean(environment.GOOGLE_CLIENT_ID);
    const hasGoogleSecret = Boolean(environment.GOOGLE_CLIENT_SECRET);

    if (hasGoogleId !== hasGoogleSecret) {
      context.addIssue({
        code: "custom",
        message: "Google OAuth must be configured as a complete pair.",
      });
    }
  });

export type RuntimeEnvironmentCheck =
  | { ready: true }
  | { ready: false };

export function validateRuntimeEnvironment(
  environment: Record<string, string | undefined>
): RuntimeEnvironmentCheck {
  const parsed = runtimeEnvironmentSchema.safeParse({
    DATABASE_URL: environment.DATABASE_URL,
    NEXTAUTH_URL: environment.NEXTAUTH_URL,
    NEXTAUTH_SECRET: environment.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: environment.GOOGLE_CLIENT_ID || undefined,
    GOOGLE_CLIENT_SECRET: environment.GOOGLE_CLIENT_SECRET || undefined,
    UPLOADTHING_TOKEN: environment.UPLOADTHING_TOKEN,
  });

  return parsed.success ? { ready: true } : { ready: false };
}
