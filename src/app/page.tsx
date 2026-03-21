import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

type IUser =  {
	user: {
		name: string,
		email: string,
		image: string,
		role: string
	}
}
export default async function RootPage() {
	let session: IUser | null = null;
	session = await getServerSession(authOptions); // check user session is logged in or not
	
	if (!session) {
		redirect("/login");
	}else if(session.user.role === 'ADMIN'){
		redirect("/admin/usermanagement");
	}else if(session.user.role === 'ATTORNEY'){
		redirect("/home");
	}
}
