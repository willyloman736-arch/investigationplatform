import { APP_NAME } from "@/lib/constants";
import { WithdrawalReviewScreen } from "@/components/dashboard/WithdrawalCheckoutScreens";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Review Withdrawal · ${APP_NAME}`,
};

export default function WithdrawalReviewPage() {
  return <WithdrawalReviewScreen />;
}
