// app/api/users/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { name, email } = await req.json();
    const resolvedParams = await params;
    const userId = resolvedParams.id;

    // 1. Check if the new email is already taken by ANOTHER user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email,
        NOT: {
          id: userId, // Exclude the current user being edited
        },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "This email is already in use by another account." },
        { status: 400 }
      );
    }

    // 2. If email is unique, proceed with update
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name, email },
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    //const resolvedParams = await params;
    const { id } = await params;
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() }, // This is the "Soft Delete"
    });

    return NextResponse.json({ message: "User moved to trash" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete user" }, 
      { status: 500 }
    );
  }
}