// components/TeamTable.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import StaffAction from "./StaffAction";
import { notFound } from "next/navigation";
type iSession = {
  user: {
    id:string;
  }
}

export default async function TeamTable() {
  const session = await getServerSession(authOptions) as iSession;
    if (!session || !session.user) {
      notFound();
    }
  const attorneyId = session.user.id;
  const team = await prisma.user.findMany({
    where: { parentId: attorneyId },
  });

  
  return (
    <div className="table-responsive">

      <table className="min-w-full border table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Permissions</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {team.map((member) => (
            <tr key={member.id}>
              <td>{member.name}</td>
              <td>{member.email}</td>
              <td>
                {Object.entries(member.permissions as object)
                  .filter(([_, val]) => val)
                  .map(([key]) => key).join(", ")}
              </td>
              <td>
                <StaffAction memberId={member.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}