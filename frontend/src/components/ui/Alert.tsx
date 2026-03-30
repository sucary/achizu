import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const alertVariants = cva(
    'p-2 border rounded text-sm text-text',
    {
        variants: {
            variant: {
                error: 'bg-error/10 border-error/30',
                success: 'bg-green-500/10 border-green-500/30',
                warning: 'bg-yellow-500/10 border-yellow-500/30',
                info: 'bg-blue-500/10 border-blue-500/30',
            },
        },
        defaultVariants: {
            variant: 'info',
        },
    }
);

export interface AlertProps extends VariantProps<typeof alertVariants> {
    children: ReactNode;
    className?: string;
    onClose?: () => void;
}

export function Alert({ variant, children, className, onClose }: AlertProps) {
    return (
        <div role="alert" className={cn(alertVariants({ variant }), 'flex items-center justify-between gap-2', className)}>
            <span>{children}</span>
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                    aria-label="Dismiss"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
}
