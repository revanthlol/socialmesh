import crypto from "node:crypto";
import argon2 from "argon2";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import type { RegisterInput, LoginInput } from "./auth.schemas.js";

const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashIp(ip?: string): string | null {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export class AuthService {
  async register(
    input: RegisterInput,
    meta?: { userAgent?: string; ip?: string },
  ) {
    const normalizedEmail = input.email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw AppError.conflict(
        "An account with this email address already exists",
      );
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    const workspaceName =
      input.workspaceName?.trim() || `${input.displayName.trim()}'s Workspace`;

    // Execute user, workspace, membership, and initial session creation atomically
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          displayName: input.displayName.trim(),
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: "OWNER",
        },
      });

      const session = await tx.session.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          userAgent: meta?.userAgent ?? null,
          ipHash: hashIp(meta?.ip),
        },
      });

      return { user, workspace, session };
    });

    return {
      sessionToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
        createdAt: result.user.createdAt,
      },
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
        role: "OWNER" as const,
      },
      session: {
        id: result.session.id,
        expiresAt: result.session.expiresAt,
      },
    };
  }

  async login(input: LoginInput, meta?: { userAgent?: string; ip?: string }) {
    const normalizedEmail = input.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!user) {
      throw AppError.unauthorized("Invalid email or password");
    }

    const validPassword = await argon2.verify(
      user.passwordHash,
      input.password,
    );
    if (!validPassword) {
      throw AppError.unauthorized("Invalid email or password");
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: meta?.userAgent ?? null,
        ipHash: hashIp(meta?.ip),
      },
    });

    const workspaces = user.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
    }));

    return {
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      workspaces,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    };
  }

  async validateSession(rawToken: string) {
    const tokenHash = hashToken(rawToken);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        // Clean up expired session
        await prisma.session
          .delete({ where: { id: session.id } })
          .catch(() => null);
      }
      return null;
    }

    // Touch lastSeenAt periodically if older than 5 minutes
    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      await prisma.session
        .update({
          where: { id: session.id },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => null);
    }

    return session;
  }

  async logout(rawToken: string) {
    const tokenHash = hashToken(rawToken);
    await prisma.session.deleteMany({
      where: { tokenHash },
    });
  }

  async logoutAll(userId: string) {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            createdAt: true,
            workspace: {
              select: {
                id: true,
                name: true,
                timezone: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    const workspaces = user.memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      timezone: m.workspace.timezone,
      role: m.role,
      joinedAt: m.createdAt,
    }));

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      workspaces,
    };
  }
}

export const authService = new AuthService();
