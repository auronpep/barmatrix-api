// J7 doctrinal lessons reset placeholder.

export interface DoctrinalLesson {
  slug: string;
  title: string;
  subject: string;
  estimated_minutes: number;
  body_md: string;
}

const LESSONS: Record<string, DoctrinalLesson> = {};

export function getDoctrinalLesson(slug: string): DoctrinalLesson | null {
  return LESSONS[slug] ?? null;
}

export function isDoctrinalApproved(): boolean {
  return process.env.DOCTRINAL_APPROVED === "1";
}
