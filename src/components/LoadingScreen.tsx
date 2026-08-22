export function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-5">
        <img
          src="/icon-512.png"
          alt="Lafz"
          className="w-16 h-16 rounded-2xl shadow-card"
        />
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-2xl font-display font-semibold text-foreground">
            Lafz
          </h1>
          <div className="relative w-8 h-8">
            <svg
              className="animate-spin w-full h-full text-primary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-20"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-80"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
