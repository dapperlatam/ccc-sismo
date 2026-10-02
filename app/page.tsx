import { getDataset } from "@/lib/data";
import Header from "@/components/Header";
import Explorer from "@/components/Explorer";

export default async function Home() {
  const data = await getDataset();
  return (
    <div className="min-h-screen px-4 pb-16 pt-8 md:px-14 md:pt-10">
      <div className="mx-auto max-w-[1280px]">
        <Header />
        <div className="my-8 border-t border-[var(--border)]" />
        <Explorer records={data.records} generatedAt={data.generated_at} />
      </div>
    </div>
  );
}