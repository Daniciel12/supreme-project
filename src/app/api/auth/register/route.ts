import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { registerPayloadSchema } from "@/lib/api-validation";
import {
  attachRateLimitHeaders,
  clientRateLimitKey,
  rateLimitExceededResponse,
  registrationRateLimiter,
} from "@/lib/rate-limit";

const SALT_ROUNDS = 10;
const REGISTRATION_CONFLICT_ERROR = "Não foi possível concluir o cadastro.";

// POST /api/auth/register
// Body: { email: string, password: string, name?: string }
export async function POST(request: NextRequest) {
  const rateLimit = registrationRateLimiter.check(
    clientRateLimitKey(request, "registration")
  );

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit);
  }

  const respond = <T extends Response>(response: T) =>
    attachRateLimitHeaders(response, rateLimit);

  try {
    const payload = registerPayloadSchema.safeParse(await request.json());

    if (!payload.success) {
      return respond(
        NextResponse.json({ error: "Payload inválido." }, { status: 400 })
      );
    }

    const { email, password, name } = payload.data;

    // Perform the expensive password work before the duplicate-email lookup so
    // the conflict path does not become an obvious fast account-enumeration path.
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return respond(
        NextResponse.json(
          { error: REGISTRATION_CONFLICT_ERROR },
          { status: 400 }
        )
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    return respond(
      NextResponse.json(
        { id: user.id, email: user.email, name: user.name },
        { status: 201 }
      )
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return respond(
        NextResponse.json({ error: "Payload inválido." }, { status: 400 })
      );
    }

    // Cover the race where another request creates the same unique email after
    // the lookup but before this request reaches user.create().
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") {
      return respond(
        NextResponse.json(
          { error: REGISTRATION_CONFLICT_ERROR },
          { status: 400 }
        )
      );
    }

    console.error("[POST /api/auth/register]", error);
    return respond(
      NextResponse.json(
        { error: "Erro ao cadastrar usuário." },
        { status: 500 }
      )
    );
  }
}
