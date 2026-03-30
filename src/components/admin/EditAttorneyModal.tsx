// components/admin/EditAttorneyModal.tsx
"use client";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';

const formSchema = z.object({
    name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
    email: z.string().min(5, { message: 'SKU must be at least 5 characters.' }),
    
});
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function EditAttorneyModal({ isOpen, onClose, user, onUserUpdated }: any) {
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: user.name,
            email: user.email,
        }
    });

  if (!isOpen || !user) return null;

  async function onFormSubmit(values: z.infer<typeof formSchema>) {

    setLoading(true);

    try {
        const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        });

        const data = await res.json();

        if (!res.ok) {
        // This will now show "This email is already in use..."
        throw new Error(data.error || "Update failed");
        }

        onUserUpdated(data);
        toast.success("Attorney updated!");
        onClose();
    } catch (error: any) {
        toast.error(error.message); // Displays the custom API error
    } finally {
        setLoading(false);
    }
};

  return (
    <div className="bg-background text-foreground rounded-lg"> 
    <Form {...form}>
            
            <form onSubmit={form.handleSubmit(onFormSubmit)} className="grid gap-4 py-4">
           
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-2 md:grid-cols-4 items-center gap-4">
                            <FormLabel className="text-right">Name</FormLabel>
                            <FormControl className="col-span-3">
                                <Input {...field} placeholder="Enter name" />
                            </FormControl>
                            <FormMessage className="col-span-3 col-start-2" />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem className="grid grid-cols-2 md:grid-cols-4 items-center gap-4">
                            <FormLabel className="text-right">Name</FormLabel>
                            <FormControl className="col-span-3">
                                <Input type='email' {...field} placeholder="Enter Email" />
                            </FormControl>
                            <FormMessage className="col-span-3 col-start-2" />
                        </FormItem>
                    )}
                />

                <div className="mt-[10px] mb-[-20px] flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => onClose(false)}>
                        Cancel
                    </Button>
                    <Button disabled={loading} type="submit">{loading ? 'Updating...' : 'Update'}</Button>
                </div>
            </form>
        </Form>
        </div>
  );
}