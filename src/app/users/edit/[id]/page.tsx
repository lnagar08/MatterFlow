import Link from "next/link";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import { NextResponse } from "next/server";
import EditStaffForm from "@/components/EditStaffForm";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
type iSession = {
  user: {
    id:string;
  }
}

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions) as iSession;
  
  const attorneyId = session.user.id;
  const { id } = await params;
    if (attorneyId !== session.user.id) {
        redirect("/users");
    }

  const staff = await prisma.user.findFirst({
    where: { 
        id: id
     },
  });
  if (!staff) return notFound();

  return (
    <main>
      <AppNav active="new" />
      <div className="header-row">
        <h1 style={{ margin: 0 }}>Edit User</h1>
        <Link className="button" href="/users">
          Back to User Managements
        </Link>
      </div>

      <EditStaffForm
        attorneyId={attorneyId}
        initialData={staff}
      />
    </main>
  );
}
