// app/(admin)/admin/usermanagement/page.tsx
"use client";
import AddAttorneyModal from "@/components/admin/AddUserModal";
import EditAttorneyModal from "@/components/admin/EditAttorneyModal";
import DeleteUserModal from "@/components/admin/DeleteUserModal";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import PageHeader from "@/components/navigation/page-header";
import CustomSearch from "@/components/custom-controls/custom-search";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import DataTable from "@/components/tables/data-table";
import CustomDialogWrapper from "@/components/custom-controls/custom-dialog-wrapper";

import { DateRange } from "react-day-picker";

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}
const ITEMS_PER_PAGE = 5;
export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
	const [totalPages, setTotalPages] = useState(Math.ceil(users.length / ITEMS_PER_PAGE));
	const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
	const [paginatedData, setPaginatedData] = useState<User[]>([]);
	const [search, setSearch] = useState('');

  // Fetch users from our new API
  const fetchUsers = async () => {
      try {
        const response = await fetch("/api/admin/users");
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        toast.error("Failed to load users");
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchUsers();
  }, []);

	useEffect(() => {
		setPaginatedData(users.slice(startIndex, startIndex + ITEMS_PER_PAGE));
	}, [currentPage, users]);

	useEffect(() => {
		setTotalPages(Math.ceil(users.length / ITEMS_PER_PAGE));
	}, [users]);

	useEffect(() => {
		if (search?.length > 0) {
			setCurrentPage(1);
			const filteredData = users.filter((user) =>
				user.name.toLowerCase().includes(search.toLowerCase())
			);
			setUsers(filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE));
		} else {
			fetchUsers();
		}
	}, [search]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading users...</div>;

  return (
    <>
			<PageHeader
				items={[
					{ label: 'Home', href: '/admin/usermanagement' },
					{ label: 'Users Management', href: '/admin/usermanagement' }
				]}
				heading="Users Management"
			>
				<div className="space-y-4">
					<div className="flex flex-col items-start justify-between gap-4 sm:flex-row md:items-center">
						<CustomSearch
							value={search}
							onChange={setSearch}
							className="w-full sm:w-[200px]"
							placeholder="Search by Name"
						/>

						
						
					</div>
				</div>
			</PageHeader>

			<div>
				<DataTable
					users={users}
					data={paginatedData as unknown as User[]}
					currentPage={currentPage}
					totalPages={totalPages}
					onPageChange={setCurrentPage}
					setUsers={setUsers}
				/>
			</div>
    </>
  );
}