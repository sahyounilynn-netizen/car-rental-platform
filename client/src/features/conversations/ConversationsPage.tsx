import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareMore } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { formatDate, getApiMessage } from "@/lib/format";
import { useSession } from "@/features/auth/useSession";
import type { Conversation } from "@/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/ui/page-intro";
import { Textarea } from "@/components/ui/textarea";

export function ConversationsPage() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { conversationId: selectedConversationId } = useParams<{ conversationId?: string }>();
  const [messageDraft, setMessageDraft] = useState("");
  const isAdmin = session.user?.role === "ADMIN";
  const pageTitle = isAdmin ? "Inbox" : "Messages";
  const pageDescription = isAdmin
    ? "Review customer threads for your shop and reply from your business account."
    : "Talk directly with rental shops about availability, pricing, pickup, and bookings.";
  const emptyThreadLabel = isAdmin ? "No customer messages yet" : "No shop messages yet";
  const composerPlaceholder = isAdmin ? "Reply to this customer" : "Write a message to this shop";
  const sendLabel = isAdmin ? "Send reply" : "Send message";
  const markReadLabel = isAdmin ? "Mark customer messages as read" : "Mark shop messages as read";

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
    <div className="page-stack">
      <PageIntro eyebrow="Messages" title={pageTitle} description={pageDescription} />

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
            <CardDescription>{isAdmin ? "Customer threads for your shop." : "Your open discussions with rental shops."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(conversationsQuery.data ?? []).map((conversation: Conversation) => (
              <button
                key={conversation.id}
                className={cn(
                  "transition-soft w-full rounded-2xl border p-4 text-left",
                  selectedConversationId === conversation.id
                    ? "border-blue-200 bg-blue-50 shadow-[0_1px_2px_rgba(37,99,235,0.08)]"
                    : "border-border bg-card hover:bg-slate-50",
                )}
                onClick={() => navigate(`/conversations/${conversation.id}`)}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-foreground">
                    {isAdmin ? conversation.user.name : conversation.shop.name}
                  </p>
                  <span className="text-xs text-muted-foreground">{formatDate(conversation.updatedAt)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {conversation.messages[conversation.messages.length - 1]?.body ?? emptyThreadLabel}
                </p>
              </button>
            ))}

            {!conversationsQuery.isLoading && !(conversationsQuery.data?.length ?? 0) ? (
              <div className="empty-state">
                <MessageSquareMore className="mb-3 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">{emptyThreadLabel}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedConversationQuery.data
                ? isAdmin
                  ? selectedConversationQuery.data.user.name
                  : selectedConversationQuery.data.shop.name
                : "Conversation"}
            </CardTitle>
            <CardDescription>
              {isAdmin
                ? "Only conversations belonging to your shop are visible here."
                : "Only your own conversations with shops are visible here."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[480px] space-y-3 overflow-y-auto rounded-2xl border border-border bg-slate-50/70 p-4">
              {(selectedConversationQuery.data?.messages ?? []).map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-none",
                    message.senderId === session.user?.id
                      ? "ml-auto bg-blue-600 text-white"
                      : "bg-card text-slate-700 ring-1 ring-border",
                  )}
                >
                  <p className="mb-1 text-xs font-semibold opacity-80">{message.sender.name}</p>
                  <p className="leading-6">{message.body}</p>
                </div>
              ))}
            </div>

            <Textarea
              className="min-h-28"
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
              placeholder={composerPlaceholder}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => sendMessageMutation.mutate()}
                disabled={sendMessageMutation.isPending || !messageDraft.trim() || !selectedConversationId}
              >
                {sendLabel}
              </Button>
              <Button
                variant="outline"
                onClick={() => markReadMutation.mutate()}
                disabled={markReadMutation.isPending || !selectedConversationId}
              >
                {markReadLabel}
              </Button>
            </div>

            {sendMessageMutation.error ? (
              <Alert variant="destructive">{getApiMessage(sendMessageMutation.error)}</Alert>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
