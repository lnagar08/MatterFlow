import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RootPage() {
	const session = await getServerSession(authOptions); // check user session is logged in or not

	if (!session) {
		redirect("/login");
	}else {
		redirect("/home");
	}
}
