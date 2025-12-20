import * as React from "react";
import { cn } from "@/lib/utils";

export interface LoadingSpinnerProps extends React.ComponentProps<"div"> {
  size?: "sm" | "md" | "lg" | "xl";
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> & {
  Page: typeof LoadingPage;
  Card: typeof LoadingCard;
} = ({ size = "md", className = "", ...props }) => {
  const sizes = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  const classes = cn(
    "animate-spin rounded-full border-b-2 border-primary",
    sizes[size],
    className
  );

  return <div className={classes} {...props}></div>;
};

export interface LoadingPageProps extends React.ComponentProps<"div"> {
  message?: string;
}

const LoadingPage: React.FC<LoadingPageProps> = ({
  message = "Loading...",
  className = "",
  ...props
}) => (
  <div
    className={cn(
      "min-h-screen bg-background flex items-center justify-center",
      className
    )}
    {...props}
  >
    <div className="text-center">
      <LoadingSpinner size="lg" className="mx-auto mb-4" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  </div>
);

const LoadingCard: React.FC<LoadingPageProps> = ({
  message = "Loading...",
  className = "",
  ...props
}) => (
  <div
    className={cn(
      "bg-card rounded-2xl shadow-xl p-8 text-center",
      className
    )}
    {...props}
  >
    <LoadingSpinner size="lg" className="mx-auto mb-4" />
    <p className="text-muted-foreground">{message}</p>
  </div>
);

LoadingSpinner.Page = LoadingPage;
LoadingSpinner.Card = LoadingCard;

export default LoadingSpinner;
export { LoadingPage, LoadingCard };
