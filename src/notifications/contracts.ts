export type FailureNotification = {
  platform: string;
  accountName: string;
  shopName?: string;
  failedAt: string;
  category:
    | "waiting_auth"
    | "network"
    | "page_changed"
    | "data_validation"
    | "publish";
  action: string;
};

export function serializeFailureNotification(
  notification: FailureNotification
): FailureNotification {
  return {
    platform: notification.platform,
    accountName: notification.accountName,
    ...(notification.shopName ? { shopName: notification.shopName } : {}),
    failedAt: notification.failedAt,
    category: notification.category,
    action: notification.action
  };
}
