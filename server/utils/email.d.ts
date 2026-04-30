export interface Emailer {
  isNull?: boolean;
  sendMagicLink: (to: string, link: string) => Promise<void>;
}

export declare const useEmail: () => Emailer;
