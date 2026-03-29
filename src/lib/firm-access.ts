import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

async function ensureDevBootstrapContext() {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  try {
    const firm = await prisma.firm.findFirst({
      orderBy: { createdAt: "asc" }
    });

    if (!firm) {
      return null;
    }

    return {
      user: {
        id: "dev-fallback-user",
        name: "PPM Admin",
        email: "admin@ppmlawyers.com",
        emailVerified: null,
        image: null,
        createdAt: new Date(0),
        updatedAt: new Date(0)
      },
      membership: {
        id: "dev-fallback-membership",
        firmId: firm.id,
        userId: "dev-fallback-user",
        role: "ADMIN",
        createdAt: new Date(0),
        updatedAt: new Date(0),
        firm
      }
    };
  } catch {
    // If the DB is in a partial state (for example missing enum types),
    // avoid crashing dev runtime and let routing fallback handle it.
    return null;
  }
}

async function getFallbackContext() {
  let fallback = null as Awaited<ReturnType<typeof ensureDevBootstrapContext>> extends infer T
    ? T extends { membership: infer M } ? (M & { user: any; firm: any }) | null : null
    : null;
  try {
    fallback = await prisma.firmMembership.findFirst({
      include: {
        user: true,
        firm: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });
  } catch {
    return ensureDevBootstrapContext();
  }

  if (!fallback) {
    return ensureDevBootstrapContext();
  }

  return {
    user: fallback.user,
    membership: {
      ...fallback,
      firm: fallback.firm
    }
  };
}

export async function getCurrentUserContext() {
  return getFallbackContext();
}

export async function requireFirmMembership() {
  const context = await getCurrentUserContext();

  if (!context || !context.membership) {
    redirect("/login");
  }

  return {
    user: context.user,
    membership: context.membership
  };
}

export async function requireAdminMembership() {
  const context = await requireFirmMembership();
  if (context.membership.role !== "ADMIN") {
    redirect("/matters");
  }
  return context;
}
