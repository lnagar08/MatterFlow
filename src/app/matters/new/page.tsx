import Link from "next/link";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import { MatterCreateForm } from "@/components/matter-create-form";
import { requireFirmMembership } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";
import { getFirmTemplates } from "@/lib/templates";
import { NextResponse } from "next/server";
import { redirect } from 'next/navigation';
export const dynamic = "force-dynamic";
type iSession = {
  user: {
    id:string;
    role: string;
    parentId: string;
    permissions: {
      addMatter: boolean;
      addClient: boolean;
    }
  }
}
export default async function NewMatterPage() {
  const session = await getServerSession(authOptions) as iSession;
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
  }
  const userid = (session.user.role === 'STAFF'? session.user.parentId: session.user.id);
  if(session.user.role === 'STAFF' && !session.user.permissions.addMatter){
    redirect('/access-denied');
  }
  const isClientPermission = (session.user.role === 'STAFF' && !session.user.permissions.addClient? true: false);
  
  const { membership } = await requireFirmMembership();

  const [clients, templates] = await Promise.all([
    prisma.client.findMany({
      where: { userId: userid },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        companyName: true
      }
    }),
    getFirmTemplates(membership.firmId)
  ]);
  const templatesList = Array.isArray(templates) 
  ? templates.map((template: any) => ({ id: template.id, name: template.name }))
  : [];
  return (
    <main>
      <AppNav active="new" />
      <div className="header-row">
        <h1 style={{ margin: 0 }}>New Matter</h1>
        <Link className="button" href="/home">
          Back to Flow Control
        </Link>
      </div>

      <MatterCreateForm
        clients={clients}
        templates={templatesList}
        isClientPermission={isClientPermission}
      />
    </main>
  );
}
