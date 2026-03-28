"use client"
import { createTeamMember, updateTeamMember } from "@/actions/users";
import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { z } from "zod";
import { useRouter } from "next/navigation";

const UserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
});

export default function EditStaffForm({ attorneyId, initialData }: { attorneyId: string, initialData?: any }) {
  const [error, setError] = useState(""); // General error
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({}); // Field specific errors
  const [isSubmiting, setIsSubmitting] = useState(false);
  const router = useRouter();

    const hasPermission = (key: string) => {
    if (!initialData?.permissions) return false;
    
    // If you stored it as an object { addMatter: true }
    const perms = initialData.permissions as Record<string, boolean>;
    return perms[key] === true;
    };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    
    setIsSubmitting(true);
    setError("");
    setFieldErrors({});

    // 1. Client-side Validation using Zod
    const validatedFields = UserSchema.safeParse(Object.fromEntries(formData.entries()));

    if (!validatedFields.success) {
      setFieldErrors(validatedFields.error.flatten().fieldErrors);
      setIsSubmitting(false);
      return; // Stop execution if validation fails
    }

    try {
      // 2. Call Server Action with 'await'
      
      const result = await updateTeamMember(formData);
      
      if (result?.error) {
        setError(result.error);
      } else {
        
        toast.success("User updated successfully!");

        
        setTimeout(() => {
          router.push("/users"); 
          router.refresh(); 
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong with the server connection.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* General Error Message */}
      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg text-center">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="card grid matter-create-card">
        <div className="row">
          <div className="col-6">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input 
                name="name" 
                type="text" 
                placeholder="Enter Full Name" 
                className="input" 
                defaultValue={initialData?.name || ""} 
                />
              {fieldErrors.name && <span className="text-red-500 text-xs">{fieldErrors.name[0]}</span>}
            </div>
          </div>
          <div className="col-6">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input 
                name="email" 
                type="email" 
                placeholder="Enter Email Address" 
                className="input" 
                defaultValue={initialData?.email || ""} 
                readOnly
              />
              {fieldErrors.email && <span className="text-red-500 text-xs">{fieldErrors.email[0]}</span>}
            </div>
          </div>
        </div>

        <input type="hidden" name="userId" value={initialData.id} />
        
        <div className="row">
          <div className="col-12">
            <div className="form-group">
              <label className="font-semibold">Permissions:</label>
              <div className="permission-checklist">
                {["addMatter", "viewMatter", "editMatter", "addClient", "addTemplates"].map((perm) => (
                <label key={perm} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="permissions" defaultChecked={hasPermission(perm)}  value={perm} /> {perm.replace(/([A-Z])/g, ' $1')}
                    
                </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="row temp-action-row" style={{ gap: 10 }}>
          <button type="submit" className="button primary" disabled={isSubmiting}>
            {isSubmiting ? "Updating..." : "Update"}
          </button>
        </div>
      </form>
    </>
  );
}
