import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Eye, Pencil, PencilLine, Trash } from 'lucide-react';

import { format } from 'date-fns';
import { useState } from 'react';
import CustomDialogWrapper from '../custom-controls/custom-dialog-wrapper';
import EditAttorneyModal from '../admin/EditAttorneyModal';
import DeleteUserModal from '../admin/DeleteUserModal';
import toast from 'react-hot-toast';

interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
} 
interface IDataTableProps {
	data: User[];
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	setUsers: React.Dispatch<React.SetStateAction<User[]>>; 
	users: User[];
}

const DataTable = ({
	data,
	currentPage,
	totalPages,
	onPageChange,
	setUsers,
	users
}: IDataTableProps) => {

	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);

	const [userToDelete, setUserToDelete] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);
	

	const handleEditClick = (user: User) => {
		setSelectedUser(user);
		setIsEditModalOpen(true);
  	};
	const handleUserDelete = (user: User) => {
		setSelectedUser(user);
		setUserToDelete(true);
	}
	const handleDeleteConfirmed = async () => {
		if (!selectedUser) return;

		setDeleteLoading(true);
		try {
			const res = await fetch(`/api/admin/users/${selectedUser.id}`, { method: "DELETE" });
			
			if (!res.ok) throw new Error("Delete failed");

			// Remove from local state
			setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
			toast.success("User deleted successfully");
			setUserToDelete(false);
		} catch (error) {
			toast.error("Error deleting user");
		} finally {
			setDeleteLoading(false);
		}
	};
	const handleUserUpdated = (updatedUser: User) => {
		setUsers((prev) => 
		prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
		);
	};
	return (
		<>
		<div className="space-y-4 bg-background p-4 rounded-xl border border-border">
					<div className="w-full overflow-auto">
						<Table className="text-foreground">
						<TableHeader className="bg-muted/50">
							<TableRow className="border-b border-border">
							<TableHead className="!border-none pl-4">Name</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>Date of Joining</TableHead>
							<TableHead className="!border-none pr-1">Action</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody className="!px-3">
						{data.map((user) => (
							<TableRow key={user.id} className="!border-none">
								<TableCell className="pl-4">
									<h6 className="text-sm font-medium">{user.name}</h6>
								</TableCell>
								<TableCell>
									<h6 className="text-sm font-medium">{user.email}</h6>
									
								</TableCell>
								<TableCell>{format(user.createdAt, 'dd MMM yyyy')}</TableCell>
								
								
								
								<TableCell>
									<div className="flex flex-wrap items-center gap-4">
										<Button onClick={() => handleEditClick(user)} 
										variant="ghost" size="sm" variantClassName={'secondary'}>
											<Pencil />
										</Button>
										<Button 
											onClick={() => handleUserDelete(user)} 
											variant="ghost" size="sm" variantClassName={'danger'}>
										
											<Trash />
										</Button>
									</div>
									
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			<div className="flex items-center justify-end space-x-2 p-4 bg-background"> 
				<div className="text-muted-foreground text-sm">
					{currentPage} - {totalPages} of {totalPages}
				</div>
				<Button
					variant="outline"
					size="icon"
					
					className="border-input bg-background hover:bg-accent hover:text-accent-foreground text-foreground"
					onClick={() => onPageChange(currentPage - 1)}
					disabled={currentPage === 1}
				>
					<ChevronLeft className="h-4 w-4 text-foreground" /> 
				</Button>
				<Button
					variant="outline"
					size="icon"
					className="border-input bg-background hover:bg-accent hover:text-accent-foreground text-foreground"
					onClick={() => onPageChange(currentPage + 1)}
					disabled={currentPage === totalPages}
				>
					<ChevronRight className="h-4 w-4 text-foreground" />
				</Button>
			</div>

		</div>

		<CustomDialogWrapper
				isOpen={isEditModalOpen}
				onOpenChange={setIsEditModalOpen}
				title="Update Attorney"
			>
			<EditAttorneyModal 
			isOpen={isEditModalOpen}
			user={selectedUser}
			onClose={() => setIsEditModalOpen(false)}
			onUserUpdated={handleUserUpdated}
			/>
		</CustomDialogWrapper>

		<CustomDialogWrapper
				isOpen={!!userToDelete}
				onOpenChange={setUserToDelete}
				title="Update Attorney"
			>
			<DeleteUserModal 
				isOpen={!!userToDelete}
				loading={deleteLoading}
				onClose={() => setUserToDelete(false)}
				onConfirm={handleDeleteConfirmed}
			/>
		</CustomDialogWrapper>
	</>
	);
};

export default DataTable;
