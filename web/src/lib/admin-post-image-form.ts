export interface PostImageFormInput {
  file: File | null;
  alt: string;
}

export function canUploadPostImage({ file, alt }: PostImageFormInput): boolean {
  return file !== null && alt.trim().length > 0;
}
