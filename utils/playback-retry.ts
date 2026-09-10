// A playback attempt may resolve a fresh signed URL once (VKB-182). Both feed
// players share this so the bound — and the condition that lifts it — cannot
// drift apart between audio and video.

const REFRESHES_PER_ATTEMPT = 1;

export type RefreshAllowance = {
  spend: () => boolean;
  restore: () => void;
};

export const createRefreshAllowance = (): RefreshAllowance => {
  let remaining = REFRESHES_PER_ATTEMPT;
  return {
    spend: () => {
      if (remaining <= 0) return false;
      remaining -= 1;
      return true;
    },
    restore: () => {
      remaining = REFRESHES_PER_ATTEMPT;
    },
  };
};
