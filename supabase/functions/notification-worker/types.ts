export type Status =
  | "backlog"
  | "playing"
  | "completed"
  | "paused"
  | "abandoned"
  | "remembered"
  | "wishlist"
  | "upcoming";
export type JournalRecord = {
  id?: string;
  title: string;
  year: number | null;
  release?: string;
  platforms: string;
  device: string;
  period: string;
  started: string;
  finished: string;
  status: Status;
  ownership: string;
  priority: number | string | null;
  hype: string;
  hours: number | null;
  estimated: string;
  rating: number | null;
  memorability: number | null;
  impression: string;
  focus: string;
  replay: string;
  reason: string;
  notes: string;
  sourceKey: string;
  pages?: string[];
  sourceSnapshot?: Record<string, unknown>;
  updated_at?: string;
  offers?: Offer[];
};
export type Offer = {
  id: string;
  game_id: string;
  url: string;
  store: string;
  region: string;
  currency: string | null;
  price: number | null;
  regular_price: number | null;
  discount: number;
  status: string;
  checked_at: string | null;
  last_success_at?: string | null;
  error: string | null;
  watched: boolean;
  target_price: number | null;
};
export type Price = {
  name?: string;
  status: string;
  price: number | null;
  regular: number | null;
  currency: string | null;
  discount: number;
  release?: string;
};
export const statuses: Record<Status, string> = {
  backlog: "Pendiente",
  playing: "Jugando",
  completed: "Terminado",
  paused: "En pausa",
  abandoned: "No terminado",
  remembered: "Recuerdo",
  wishlist: "Lista de deseos",
  upcoming: "Próximo",
};
export const emptyRecord: JournalRecord = {
  title: "",
  year: null,
  platforms: "",
  device: "",
  period: "",
  started: "",
  finished: "",
  status: "backlog",
  ownership: "No",
  priority: null,
  hype: "",
  hours: null,
  estimated: "",
  rating: null,
  memorability: null,
  impression: "",
  focus: "",
  replay: "",
  reason: "",
  notes: "",
  sourceKey: "",
};
