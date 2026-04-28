export interface InviteResult {
  status: "success" | "error";
  message: string;
}

export interface InviteResultPopupProps {
  result: InviteResult | null;
}
