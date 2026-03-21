"use client"

import { Pencil, Trash } from "lucide-react";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { deleteTeamMember } from "@/actions/users";
import toast from "react-hot-toast";
export default function StaffAction({memberId}: {memberId: string}){
    const router = useRouter();
    const handleEditClick = (staffId: string) => {
        router.push(`/users/edit/${staffId}`); 
        router.refresh(); 
    }

    const handleUserDelete = async (staffId: string) => {
        if (!staffId) return;
  
        const confirmed = window.confirm(
            `Are you sure you want to delete? This action cannot be undone.`
        );

        if (confirmed) {
            try {
                await deleteTeamMember(staffId);
                toast.success("User deleted successfully");
                setTimeout(() => {
                    router.push("/users"); 
                    router.refresh(); 
                }, 1500);
            } catch (err) {
                toast.error("An error occurred while deleting.");
            }
        }
    }
    return(
        <div className="flex flex-wrap items-center gap-4">
            <Button onClick={() => handleEditClick(memberId)} 
            variant="ghost" size="sm" variantClassName={'secondary'}>
                <Pencil />
            </Button>
            <Button 
                onClick={() => handleUserDelete(memberId)} 
                variant="ghost" size="sm" variantClassName={'danger'}>
            
                <Trash />
            </Button>
        </div>
    );
}