import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { formatDate, getApiMessage } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import type { Conversation } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function ConversationsPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { conversationId: selectedConversationId } = useParams<{ conversationId?: string }>();
  const [messageDraft, setMessageDraft] = useState("");

  const conversationsQuery = useQuery({
    queryKey: ["conversations", session.user?.role, session.user?.id, session.user?.shop?.id],
    queryFn: async () => (await api.listConversations(session.token!, session.user!.role)).conversations,
    enabled: Boolean(session.token && session.user && session.user.role !== "SUPERADMIN"),
  });

  const selectedConversationQuery = useQuery({
    queryKey: ["conversation", selectedConversationId],
    queryFn: async () => (await api.getConversation(session.token!, selectedConversationId!)).conversation,
    enabled: Boolean(session.token && selectedConversationId),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversationId) throw new Error("Choose a conversation");
      return api.sendMessage(session.token!, selectedConversationId, messageDraft);
    },
    onSuccess: () => {
      setMessageDraft("");
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation", selectedConversationId] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversationId) throw new Error("Choose a conversation");
      await api.markConversationRead(session.token!, selectedConversationId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversation", selectedConversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  useEffect(() => {
    if (conversationsQuery.data && !selectedConversationId && conversationsQuery.data[0]?.id) {
      navigate(`/conversations/${conversationsQuery.data[0].id}`, { replace: true });
    }
  }, [conversationsQuery.data, selectedConversationId, navigate]);

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{session.user?.role === "ADMIN" ? "Inbox" : "My conversations"}</CardTitle>
          <CardDescription>Select a thread to read or reply.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(conversationsQuery.data ?? []).map((conversation: Conversation) => (
            <button
              key={conversation.id}
              className={cn(
                "w-full rounded-lg border p-3 text-left",
                selectedConversationId === conversation.id ? "border-foreground bg-accent" : "border-border",
              )}
              onClick={() => navigate(`/conversations/${conversation.id}`)}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">
                  {session.user?.role === "ADMIN" ? conversation.user.name : conversation.shop.name}
                </p>
                <span className="text-xs text-muted-foreground">{formatDate(conversation.updatedAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {conversation.messages[conversation.messages.length - 1]?.body ?? "No messages yet"}
              </p>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedConversationQuery.data
              ? session.user?.role === "ADMIN"
                ? selectedConversationQuery.data.user.name
                : selectedConversationQuery.data.shop.name
              : "Conversation"}
          </CardTitle>
          <CardDescription>All messages are synced against the live API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-lg border border-border p-4">
            {(selectedConversationQuery.data?.messages ?? []).map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  message.senderId === session.user?.id
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                <p className="mb-1 text-xs opacity-80">{message.sender.name}</p>
                <p>{message.body}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              className="min-h-20"
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
              placeholder="Write a reply"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => sendMessageMutation.mutate()}
              disabled={sendMessageMutation.isPending || !messageDraft.trim() || !selectedConversationId}
            >
              Send reply
            </Button>
            <Button
              variant="outline"
              onClick={() => markReadMutation.mutate()}
              disabled={markReadMutation.isPending || !selectedConversationId}
            >
              Mark as read
            </Button>
          </div>
          {sendMessageMutation.error && (
            <p className="text-sm text-destructive">{getApiMessage(sendMessageMutation.error)}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
