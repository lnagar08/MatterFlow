import AddUserModal from "@/components/AddUserModal";
import { AppNav } from "@/components/app-nav";
import TeamTable from "@/components/TeamTable";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function UserTeamPage(){
    
    return (
    <main>
      <AppNav active="users" />
      <div className="header-row">
        <h1 style={{ margin: 0 }}>Users Management</h1>
        <div className="row" style={{ gap: 8 }}>
          <Link className="button primary" href="/users/new">
            New User
          </Link>
          <Link className="button" href="/home">
            Back to Home
          </Link>
        </div>
      </div>

      <div className="card grid" style={{ marginBottom: 16 }}>
        
        <TeamTable />
      </div>

    </main>
  );
}