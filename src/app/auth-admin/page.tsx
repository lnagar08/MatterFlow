"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2, LogIn } from "lucide-react"; // Icons for consistent design
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import RequiredAsterisk from "@/components/required-asterisk";
import { Input } from "@/components/ui/input";

import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { MoonIcon, SunIcon } from 'lucide-react';

import { useTheme } from '@/context/ThemeContext';
import logoDarkTheme from '@/assets/logo-dark-theme.svg';
import logoLightTheme from '@/assets/logo-light-theme.svg';
/**
 * Modern Login Page
 * Matches the MatterFlow registration design with Next-Auth integration.
 */
const loginSchema = z.object({
	email: z.string().min(1, 'Email is required').email('Invalid email'),
	password: z.string().min(1, 'Password is required')
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Added loading state
  const router = useRouter();
const form = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: '',
			password: '',
			
		}
	});

	async function onSubmit(data: LoginFormValues) {
		setError("");
    setIsLoading(true); // Start loading

    const result = await signIn("credentials", {
      email: data.email.toLowerCase(),
      password: data.password,
      redirect: false, 
    });

    if (result?.error) {
      setError("Invalid email or password");
      setIsLoading(false); // Stop loading on error
    } else {
      router.push("/admin/usermanagement"); 
      router.refresh();
    }
		
	}

  return (
    <>
    <div className="min-h-screen flex flex-col justify-center items-center bg-background">
			<div className="absolute top-4 right-4">
				<Button
					variant="ghost"
					variantClassName="light"
					size="icon"
					onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
				>
					{theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
				</Button>
			</div>
			<Card className="w-full max-w-md mx-auto shadow-lg">
				<CardContent className="flex flex-col gap-4 py-6">
					<div className="flex flex-col items-center gap-2">
						
						<p className="text-muted-foreground text-sm">Sign in to start your session</p>
					</div>
          {error && (
          <div className="mb-6 p-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl text-center font-medium animate-pulse">
            {error}
          </div>
        )}
    <Form {...form}>
						<form className="flex flex-col gap-3" onSubmit={form.handleSubmit(onSubmit)}>
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Email <RequiredAsterisk />
										</FormLabel>
										<FormControl>
											<Input id="email" type="email" placeholder="Email" autoFocus {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel className="text-sm font-medium">
											Password <RequiredAsterisk />
										</FormLabel>
										<FormControl>
											<Input id="password" type="password" placeholder="Password" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							
							<Button type="submit" 
              disabled={isLoading}
              className="w-full" variantClassName="primary">
								{isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              "Sign In"
            )}
							</Button>
						</form>
					</Form>
            </CardContent>
			</Card>
		</div>
   

    </>
  );
}
