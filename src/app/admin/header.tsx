"use client";
import { useSession } from "next-auth/react";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "next/navigation";

import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { MoonIcon, SunIcon, ChevronDownIcon, UserIcon, LogOutIcon } from 'lucide-react';
import { signOut } from "next-auth/react";
import { useState } from 'react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

const dropdownMenuItems = [
  { 
    label: 'Logout', 
    icon: LogOutIcon, 
    link: '#', 
    action: () => signOut({ callbackUrl: '/auth-admin' })
  }
];

const AppHeader: React.FC = () => {
	const { data: session, status } = useSession();
	const { theme, setTheme } = useTheme();
	const router = useRouter();

	const userName = session?.user?.name || session?.user?.email?.split('@')[0] || "Admin";
	const shortName = userName.slice(0, 2).toUpperCase();

	if (status === "loading") return <div>Loading...</div>;
	if (!session) return null;

	return (
		<header className="bg-background sticky top-0 z-10 flex w-full border-b-0 py-3">
			<div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
				<SidebarTrigger className="-ml-1 cursor-pointer" />
				
			</div>

			<div className="flex items-center gap-2 pr-2 lg:px-6">
				<Button
					variant="ghost"
					variantClassName="light"
					size="icon"
					onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
				>
					{theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
				</Button>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							variantClassName="light"
							className="ml-2 flex h-8 min-w-[48px] items-center rounded-full"
						>
							<div className="bg-primary ml-[-11px] flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white">
								{shortName}
							</div>
							<ChevronDownIcon className="text-muted-foreground h-2 w-2" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-[180px] px-3 py-2">
						<div className="border-muted mb-2 border-b px-2 pt-1 pb-2">
							<div className="text-foreground text-sm font-semibold">Matter Flow</div>
							<div className="text-muted-foreground text-xs">{session.user?.email}</div>
						</div>
						{dropdownMenuItems.map(({ label, icon: Icon, link }) => (
						<DropdownMenuItem
							key={label}
							onClick={() => {
							if (label === 'Logout') {
								
								signOut({ callbackUrl: '/login' });
							} else {
								
								router.push(link || '');
							}
							}}
							className={label === 'Logout' ? 'text-red-600 focus:text-red-600' : ''}
						>
							<Icon className="mr-2 h-4 w-4" />
							{label}
						</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</header>
	);
};
export default AppHeader;