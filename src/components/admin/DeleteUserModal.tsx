// components/admin/DeleteUserModal.tsx
"use client";

import { Button } from "../ui/button";

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

export default function DeleteUserModal({ isOpen, onClose, onConfirm, loading }: DeleteModalProps) {
  if (!isOpen) return null;

  return (
    
    <div className="flex-wrap gap-4">
            Are you sure you want to delete?
            <div className="mt-[20px] mb-[10px] flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button 
                onClick={onConfirm} 
                disabled={loading} 
                variantClassName="danger" 
                type="submit">{loading ? "Deleting..." : "Delete"}</Button>
            </div>
        </div>
  );
}