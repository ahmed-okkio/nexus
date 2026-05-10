import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-black p-4 items-center justify-center">
      <Card className="w-full max-w-2xl h-[80vh] flex flex-col shadow-lg">
        <CardHeader>
          <CardTitle>Nexus AI Assistant</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              <div className="text-sm bg-zinc-100 p-3 rounded-lg w-max">
                Hello! I am Nexus. How can I help you today?
              </div>
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter>
          <form className="flex w-full gap-2">
            <Input placeholder="Type a message..." className="flex-1" />
            <Button type="submit">Send</Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
