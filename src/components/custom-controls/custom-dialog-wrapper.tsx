import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ICustomDialogWrapperProps {
	children: React.ReactNode;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
}

const CustomDialogWrapper = ({
	children,
	isOpen,
	onOpenChange,
	title
}: ICustomDialogWrapperProps) => {
	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="bg-background text-foreground border-border">
				<DialogHeader>
					<DialogTitle className="text-foreground">{title}</DialogTitle>
				</DialogHeader>
				<div className="text-foreground">
					{children}
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default CustomDialogWrapper;
