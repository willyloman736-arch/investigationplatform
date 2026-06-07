import { APP_NAME } from "@/lib/constants";
import { WithdrawalSuccessScreen } from "@/components/dashboard/WithdrawalCheckoutScreens";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Withdrawal Submitted · ${APP_NAME}`,
};

export default function WithdrawalSuccessPage() {
  return <WithdrawalSuccessScreen />;
}
