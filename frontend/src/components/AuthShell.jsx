export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="container-page flex justify-center pt-12 sm:pt-20">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
        <div className="card mt-8 p-5 sm:p-7">{children}</div>
        {footer && <p className="mt-6 text-center text-[15px] text-muted">{footer}</p>}
      </div>
    </div>
  );
}
