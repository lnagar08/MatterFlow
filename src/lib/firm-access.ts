import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

async function getFallbackContext() {
  const fallback = await prisma.firmMembership.findFirst({
    include: {
      user: true,
      firm: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (!fallback) {
    return null;
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
    redirect("/");
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
