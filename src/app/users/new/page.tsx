import Link from "next/link";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import AddUserModal from "@/components/AddUserModal";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
type iSession = {
  user: {
    id:string;
  }
}
export default async function NewUserPage() {
  const session = await getServerSession(authOptions) as iSession;
  if (!session || !session.user) {
    notFound();
  }
  const attorneyId = session.user.id;
  return (
    <main>
      <AppNav active="new" />
      <div className="header-row">
        <h1 style={{ margin: 0 }}>New Team Memebr</h1>
        <Link className="button" href="/users">
          <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4.59375 9.84375H17.7188C17.8928 9.84375 18.0597 9.91289 18.1828 10.036C18.3059 10.159 18.375 10.326 18.375 10.5C18.375 10.674 18.3059 10.841 18.1828 10.964C18.0597 11.0871 17.8928 11.1562 17.7188 11.1562H4.59375C4.4197 11.1562 4.25278 11.0871 4.12971 10.964C4.00664 10.841 3.9375 10.674 3.9375 10.5C3.9375 10.326 4.00664 10.159 4.12971 10.036C4.25278 9.91289 4.4197 9.84375 4.59375 9.84375Z" fill="white"/>
          <path d="M4.86451 10.5002L10.3093 15.9409C10.3705 16.002 10.419 16.0746 10.452 16.1545C10.4851 16.2343 10.5022 16.3199 10.5022 16.4064C10.5022 16.4929 10.4851 16.5785 10.452 16.6583C10.419 16.7382 10.3705 16.8108 10.3093 16.8719C10.2482 16.9331 10.1756 16.9816 10.0957 17.0146C10.0159 17.0477 9.93026 17.0648 9.8438 17.0648C9.75735 17.0648 9.67174 17.0477 9.59186 17.0146C9.51198 16.9816 9.43941 16.9331 9.37827 16.8719L3.47202 10.9657C3.41064 10.9047 3.36192 10.8322 3.32868 10.7523C3.29543 10.6724 3.27832 10.5867 3.27832 10.5002C3.27832 10.4136 3.29543 10.3279 3.32868 10.248C3.36192 10.1681 3.41064 10.0956 3.47202 10.0346L9.37827 4.12837C9.43941 4.06724 9.51198 4.01875 9.59186 3.98566C9.67174 3.95258 9.75735 3.93555 9.8438 3.93555C9.93026 3.93555 10.0159 3.95258 10.0957 3.98566C10.1756 4.01875 10.2482 4.06724 10.3093 4.12837C10.3705 4.18951 10.419 4.26208 10.452 4.34196C10.4851 4.42184 10.5022 4.50745 10.5022 4.5939C10.5022 4.68036 10.4851 4.76597 10.452 4.84584C10.419 4.92572 10.3705 4.9983 10.3093 5.05943L4.86451 10.5002Z" fill="white"/>
          </svg>
          Back to Team Managements
        </Link>
      </div>

      <AddUserModal
        attorneyId={attorneyId}
      />
    </main>
  );
}
