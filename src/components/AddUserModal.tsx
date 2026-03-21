"use client"
import { createTeamMember } from "@/actions/users";
import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { z } from "zod";
import { useRouter } from "next/navigation";

const UserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function AddUserModal({ attorneyId }: { attorneyId: string }) {
  const [error, setError] = useState(""); // General error
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({}); // Field specific errors
  const [isSubmiting, setIsSubmitting] = useState(false);
  const router = useRouter();

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
      
      const result = await createTeamMember(formData, attorneyId);
      
      if (result?.error) {
        setError(result.error);
      } else {
        form.reset(); // Clear form on success
        toast.success("User created successfully!");

        
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
        <div className="flex flex-col gap-1">
          <input name="name" type="text" placeholder="Enter Name" className="input" />
          {fieldErrors.name && <span className="text-red-500 text-xs">{fieldErrors.name[0]}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <input name="email" type="email" placeholder="Enter Email" className="input" />
          {fieldErrors.email && <span className="text-red-500 text-xs">{fieldErrors.email[0]}</span>}
        </div>

        <div className="flex flex-col gap-1">
          <input name="password" type="password" placeholder="Enter Password" className="input" />
          {fieldErrors.password && <span className="text-red-500 text-xs">{fieldErrors.password[0]}</span>}
        </div>
        
        <div className="row">
          <div className="space-y-2">
            <p className="font-semibold">Permissions:</p>
            {["addMatter", "viewMatter", "editMatter", "addClient", "addTemplates"].map((perm) => (
              <label key={perm} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="permissions" value={perm} /> {perm.replace(/([A-Z])/g, ' $1')}
              </label>
            ))}
          </div>
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button type="submit" className="button primary" disabled={isSubmiting}>
            {isSubmiting ? "Creating..." : "Create User"}
          </button>
        </div>
      </form>
    </>
  );
}
