import type {
  Inquiry,
  DraftReply,
  SentReply,
  KnowledgeArticle,
  KnowledgeCandidate,
  Category,
  AuditLog,
} from "@prisma/client";

export type {
  Inquiry,
  DraftReply,
  SentReply,
  KnowledgeArticle,
  KnowledgeCandidate,
  Category,
  AuditLog,
};

export type InquiryStatus = "new" | "drafted" | "sent" | "archived";
export type CandidateStatus = "pending" | "approved" | "rejected";

export type CitedArticle = {
  id: string;
  title: string;
  excerpt: string;
};

export type DraftPayload = {
  body: string;
  confidence: number; // 0.0〜1.0
  citedIds: string[];
  model: string; // "claude-sonnet-4-6" | "mock"
};

export type InquiryListItem = Inquiry & {
  category: Category | null;
  latestDraft: DraftReply | null;
  hasSent: boolean;
};

export type InquiryDetail = Inquiry & {
  category: Category | null;
  latestDraft: (DraftReply & { citedArticles: CitedArticle[] }) | null;
  sent: SentReply | null;
};

export type CandidateDetail = KnowledgeCandidate & {
  sourceInquiry: Inquiry | null;
};

export type SendInquiryInput = {
  finalBody: string;
};

export type KnowledgeUpsertInput = {
  title: string;
  body: string;
  categoryId?: string | null;
};
