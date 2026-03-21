import Link from "next/link";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import AddUserModal from "@/components/AddUserModal";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
type iSession = {
  user: {
    id:string;
  }
}
export default async function NewUserPage() {
  const session = await getServerSession(authOptions) as iSession;
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
  }
  const attorneyId = session.user.id;
  return (
    <main>
      <AppNav active="new" />
      <div className="header-row">
        <h1 style={{ margin: 0 }}>New User</h1>
        <Link className="button" href="/users">
          Back to User Managements
        </Link>
      </div>

      <AddUserModal
        attorneyId={attorneyId}
      />
    </main>
  );
}
