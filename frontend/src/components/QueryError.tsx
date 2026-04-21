import { AlertCircle, RefreshCw } from "lucide-react";

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function QueryError({
  message = "Something went wrong loading this data.",
  onRetry,
}: QueryErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3"
    >
      <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-2">
        <p className="text-sm text-destructive font-medium">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline underline-offset-2"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
