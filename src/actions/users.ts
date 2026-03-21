"use server"

import { prisma } from "@/lib/prisma"; // Your Prisma client
import { hash } from "bcryptjs";

export async function createTeamMember(formData: FormData, parentId: string) {
  
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  
  // Extract permissions from checkboxes
  const selectedPermissions = formData.getAll("permissions");
  const permissions = {
    addMatter: selectedPermissions.includes("addMatter"),
    viewMatter: selectedPermissions.includes("viewMatter"),
    editMatter: selectedPermissions.includes("editMatter"),
    addClient: selectedPermissions.includes("addClient"),
    addTemplates: selectedPermissions.includes("addTemplates"),
  };

  const hashedPassword = await hash(password, 10);
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    
    return { success: false, error: "User already exists" }; 
  }
  try {
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "STAFF", // Or whichever role fits
        parentId: parentId,
        permissions: permissions, // Prisma handles JSON objects directly
      },
    });

    return { success: true, error: null }; 

  } catch (error) {
    throw error;
  }
}

export async function updateTeamMember(formData: FormData) {
  const userId = formData.get("userId") as string;
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  // Reconstruct the object exactly as it needs to be stored in JSON
  const selectedPermissions = formData.getAll("permissions");
  const permissions = {
    addMatter: selectedPermissions.includes("addMatter"),
    viewMatter: selectedPermissions.includes("viewMatter"),
    editMatter: selectedPermissions.includes("editMatter"),
    addClient: selectedPermissions.includes("addClient"),
    addTemplates: selectedPermissions.includes("addTemplates"),
  };

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: name,
        permissions: permissions, // Prisma saves this as a JSON object
      },
    });
    return { success: true, error: null }; 
  } catch (error) {
    throw error;
  }
}

export async function deleteTeamMember(userId: string) {
  try {
    await prisma.user.delete({
      where: { id: userId },
    });
    return { success: true, error: null }; 
  } catch (error) {
    return { error: "Failed to delete user. They may have active dependencies." };
  }
}