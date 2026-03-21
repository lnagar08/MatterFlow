// components/TeamTable.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import StaffAction from "./StaffAction";
type iSession = {
  user: {
    id:string;
  }
}

export default async function TeamTable() {
  const session = await getServerSession(authOptions) as iSession;
    if (!session || !session.user) {
      //return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
    }
  const attorneyId = session.user.id;
  const team = await prisma.user.findMany({
    where: { parentId: attorneyId },
  });

  
  return (
    <div className="p-6">

      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Email</th>
            <th className="p-2 text-left">Permissions</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {team.map((member) => (
            <tr key={member.id} className="border-t">
              <td className="p-2">{member.name}</td>
              <td className="p-2">{member.email}</td>
              <td className="p-2 text-xs">
                {Object.entries(member.permissions as object)
                  .filter(([_, val]) => val)
                  .map(([key]) => key).join(", ")}
              </td>
              <td className="p-2">
                <StaffAction memberId={member.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}