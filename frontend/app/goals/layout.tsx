export const metadata = {
  title: "Goal Management - Nestera",
  description: "Fine-tune your savings strategy. Manage your financial goals, adjust contribution schedules, and optimize your path to financial freedom.",
};


export default function GoalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#061218]">
      {children}
    </div>
  );
}
