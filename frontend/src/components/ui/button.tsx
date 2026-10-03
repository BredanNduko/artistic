import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,color,border-color,box-shadow,opacity] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-1 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-brand-ink hover:opacity-90 shadow-sm',
        secondary: 'bg-surface-3 text-ink hover:bg-line-strong/60',
        outline: 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
        ghost: 'text-ink-soft hover:bg-surface-3 hover:text-ink',
        subtle: 'bg-brand-soft text-brand hover:bg-brand-soft/70',
        danger: 'bg-danger text-white hover:opacity-90',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-3.5 [&_svg]:size-4',
        sm: 'h-8 px-2.5 text-xs [&_svg]:size-3.5',
        lg: 'h-11 px-6 text-base [&_svg]:size-5',
        icon: 'size-9 [&_svg]:size-4',
        'icon-sm': 'size-7 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
