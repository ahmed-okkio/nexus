import { ChatInterface } from "@/components/chat-interface";

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-black p-4 items-center justify-center">
      <ChatInterface />
    </div>
  );
}
