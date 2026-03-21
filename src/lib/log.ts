import { prisma } from "@/lib/prisma"; // Your Prisma client instance

export const logActivity = async (
  userId: string,
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN",
  entityType: string, // Table name like "PROJECT" or "TASK"
  entityId: string,   // The ID of the specific record changed
  description?: string
) => {
  try {
    // Save the log entry to the ActivityLog table
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        description,
      },
    });
  } catch (error) {
    // We use a console error so the main app doesn't crash if logging fails
    console.error("Failed to save activity log:", error);
  }
};
